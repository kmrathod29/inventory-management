# Indian billing and GST rules

The existing app implements generic/default bills plus Nepal-specific PAN and VAT bills. It does not yet implement Indian GST billing. The old VAT value and tax JSON must remain recognizable as historical data and must never be relabeled as GST.

The target design separates regular cash memo, GST tax invoice, bill of supply, quotation/estimate and delivery challan. GST charging must be gated by configurable registration status and document type. Product tax rate/HSN, business GSTIN/state, customer GSTIN, place of supply, supply type and intra/inter-state treatment must be explicit inputs. Intra-state supplies need CGST+SGST; inter-state supplies need IGST. No rate should be guessed from product name. Invoice numbering should be unique per configured financial-year series and auditable.

No legal certification is implied. Verify current requirements against CBIC GST invoice rules and an Indian tax professional. The app currently lacks configurable Indian GST rules, so GST documents and tax calculations are not production-ready until implemented and reviewed. Configuration must capture registration/composition status and applicable rate tables; exempt and reverse-charge treatment need explicit business review.
