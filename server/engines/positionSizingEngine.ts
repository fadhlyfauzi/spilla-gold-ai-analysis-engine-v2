import {
  PositionSizingInput,
  PositionSizingResult,
  SymbolSpecification,
} from '../../src/types.js';
import { symbolService } from '../services/symbolService.js';

export class PositionSizingEngine {
  /**
   * Calculate precise, broker-specification-compliant position sizing with hard safety caps.
   *
   * Formula:
   *   riskAmount = accountEquity * riskPercent / 100
   *   priceDistance = abs(entryPrice - stopLoss)
   *   ticksToSL = priceDistance / tickSize
   *   lossPerLot = ticksToSL * tickValue
   *   rawLot = riskAmount / lossPerLot
   *   normalizedCalculatedLot = clamp_and_step(rawLot, minLot, maxLot, lotStep)
   *   finalExecutionLot = min(normalizedCalculatedLot, symbol.maxTestLot)
   */
  public calculate(input: PositionSizingInput, maxRiskPercent = 3.0): PositionSizingResult {
    const resolved = symbolService.resolveSymbol(input.symbol);
    const spec = resolved.spec;
    const equity = Math.max(10, input.accountEquity || 10000);
    const entry = Number(input.entryPrice) || 1.0;
    const sl = Number(input.stopLoss) || (entry * 0.99);

    // Minimum stop distance protection (at least stopsLevel points or 2 ticks)
    const rawDelta = Math.abs(entry - sl);
    const minDelta = Math.max(spec.point * (spec.stopsLevel || 10), spec.tickSize * 2);
    const slDelta = Math.max(rawDelta, minDelta);

    const ticksToSL = slDelta / (spec.tickSize || 0.01);
    // Monetary value of 1.00 standard lot moving the SL distance
    const lossPerLot = ticksToSL * (spec.tickValue || 1.00);

    let riskPercent = 1.0;
    let riskAmount = (equity * riskPercent) / 100;
    let calculatedLot = 0.01;
    let normalizedLot = 0.01;
    let isValid = true;
    let validationReason: string | undefined;

    switch (input.mode) {
      case 'FIXED_LOT': {
        const reqLot = input.fixedLot && input.fixedLot > 0 ? input.fixedLot : 0.01;
        calculatedLot = reqLot;
        normalizedLot = this.normalizeLot(reqLot, spec);
        const estLoss = normalizedLot * lossPerLot;
        riskAmount = Number(estLoss.toFixed(2));
        riskPercent = Number(((riskAmount / equity) * 100).toFixed(2));

        if (riskPercent > maxRiskPercent) {
          isValid = false;
          validationReason = `Fixed lot ${normalizedLot} results in ${riskPercent}% risk ($${riskAmount}), exceeding maximum allowed risk of ${maxRiskPercent}%.`;
        }
        break;
      }

      case 'FIXED_RISK_AMOUNT': {
        const reqRisk = input.fixedRiskAmount && input.fixedRiskAmount > 0 ? input.fixedRiskAmount : 10.0;
        riskAmount = Number(reqRisk.toFixed(2));
        riskPercent = Number(((riskAmount / equity) * 100).toFixed(2));

        if (lossPerLot > 0) {
          calculatedLot = riskAmount / lossPerLot;
        } else {
          calculatedLot = spec.volumeMin || 0.01;
        }

        normalizedLot = this.normalizeLot(calculatedLot, spec);

        if (riskPercent > maxRiskPercent) {
          isValid = false;
          validationReason = `Fixed risk amount $${riskAmount} represents ${riskPercent}% of equity, exceeding max ${maxRiskPercent}% risk limit.`;
        }
        break;
      }

      case 'RISK_PERCENT':
      default: {
        const reqPercent = input.riskPercent && input.riskPercent > 0 ? input.riskPercent : 1.0;
        riskPercent = Math.min(reqPercent, maxRiskPercent);
        riskAmount = Number(((equity * riskPercent) / 100).toFixed(2));

        if (lossPerLot > 0) {
          calculatedLot = riskAmount / lossPerLot;
        } else {
          calculatedLot = spec.volumeMin || 0.01;
        }

        normalizedLot = this.normalizeLot(calculatedLot, spec);
        break;
      }
    }

    // Phase 1 Hard Safety Cap Application
    const safetyCapLot = spec.maxTestLot || 0.01;
    const finalExecutionLot = Math.max(spec.volumeMin || 0.01, Math.min(normalizedLot, safetyCapLot));
    const isCappedBySafety = normalizedLot > safetyCapLot;

    // Recalculate actual estimated loss at SL with the final execution lot
    const estimatedLossAtSl = Number((finalExecutionLot * lossPerLot).toFixed(2));

    // Calculate required margin
    const leverage = spec.category === 'CRYPTO' ? 20 : 100;
    const contractValue = entry * spec.contractSize * finalExecutionLot;
    const marginRequired = Number((contractValue / leverage).toFixed(2));

    // Check if margin requirement exceeds 90% of account equity
    if (marginRequired > equity * 0.9) {
      isValid = false;
      validationReason = `Required margin ($${marginRequired}) exceeds 90% of available equity ($${equity}).`;
    }

    return {
      mode: input.mode,
      risk_percent: riskPercent,
      risk_amount: riskAmount,
      calculated_lot: Number(calculatedLot.toFixed(4)),
      normalized_lot: normalizedLot,
      safety_cap_lot: safetyCapLot,
      final_execution_lot: finalExecutionLot,
      is_capped_by_safety: isCappedBySafety,
      estimated_loss_at_sl: estimatedLossAtSl,
      margin_required: marginRequired,
      lot_validation: {
        valid: isValid,
        reason: validationReason,
      },
    };
  }

  private normalizeLot(rawLot: number, spec: SymbolSpecification): number {
    const minVol = spec.volumeMin || spec.minLot || 0.01;
    const maxVol = spec.volumeMax || spec.maxLot || 100.0;
    const step = spec.volumeStep || spec.lotStep || 0.01;

    const clamped = Math.min(maxVol, Math.max(minVol, rawLot));
    const stepDecimals = step.toString().split('.')[1]?.length || 2;
    const stepped = Math.floor(clamped / step) * step;
    return Number(Math.max(minVol, stepped).toFixed(stepDecimals));
  }
}

export const positionSizingEngine = new PositionSizingEngine();

