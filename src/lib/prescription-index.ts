import { TEMPLATES } from "./program";

const prescriptionIndex = new Map<string, string>();
for (const template of TEMPLATES) {
  for (const prescription of template.prescriptions) {
    prescriptionIndex.set(prescription.id, prescription.exerciseId);
  }
}

export function exerciseIdForPrescription(prescriptionId: string) {
  return prescriptionIndex.get(prescriptionId);
}
