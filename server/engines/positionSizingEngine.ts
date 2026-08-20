import {
  PositionSizingInput,
  PositionSizingResult,
  SymbolSpecification,
} from '../../src/types.js';
import { symbolService } from '../services/symbolService.js';

export class PositionSizingEngine {
  /**
   * Calculate precise, broker-specification-compliant position sizing.
   */
  public calculate(input: PositionSizingInput, maxRiskPercent = 3.0): PositionSizingResult {
    const spec = symbolService.getSymbol(input.symbol);
    const equity = Math.max(10, input.accountEquity || 10000);
    const entry = input.entryPrice;
    const sl = input.stopLoss;

    // Minimum stop distance protection (at least stopsLevel points or 10 ticks)
    const rawDelta = Math.abs(entry - sl);
    const minDelta = Math.max(spec.point * (spec.stopsLevel || 10), spec.tickSize * 5);
    const slDelta = Math.max(rawDelta, minDelta);

    const ticks = slDelta / (spec.tickSize || 0.01);
    // Monetary value of 1.00 standard lot moving the SL distance
    const monetaryLossPerLot = ticks * (spec.tickValue || 1.00);

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
        const estLoss = normalizedLot * monetaryLossPerLot;
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

        if (monetaryLossPerLot > 0) {
          calculatedLot = riskAmount / monetaryLossPerLot;
        } else {
          calculatedLot = spec.volumeMin;
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

        if (monetaryLossPerLot > 0) {
          calculatedLot = riskAmount / monetaryLossPerLot;
        } else {
          calculatedLot = spec.volumeMin;
        }

        normalizedLot = this.normalizeLot(calculatedLot, spec);
        break;
      }
    }

    // Recalculate actual estimated loss at SL with the normalized lot
    const estimatedLossAtSl = Number((normalizedLot * monetaryLossPerLot).toFixed(2));

    // Calculate required margin (Assuming standard 1:100 leverage)
    const leverage = spec.category === 'CRYPTO' ? 20 : 100;
    const contractValue = entry * spec.contractSize * normalizedLot;
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
      estimated_loss_at_sl: estimatedLossAtSl,
      margin_required: marginRequired,
      lot_validation: {
        valid: isValid,
        reason: validationReason,
      },
    };
  }

  private normalizeLot(rawLot: number, spec: SymbolSpecification): number {
    const clamped = Math.min(spec.volumeMax, Math.max(spec.volumeMin, rawLot));
    const step = spec.volumeStep || 0.01;
    const stepDecimals = step.toString().split('.')[1]?.length || 2;
    const stepped = Math.floor(clamped / step) * step;
    return Number(Math.max(spec.volumeMin, stepped).toFixed(stepDecimals));
  }
}

export const positionSizingEngine = new PositionSizingEngine();
