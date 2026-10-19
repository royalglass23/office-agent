// RG-380 has not established Royal Glass UI/API parity for the full Job Diary.
// Keep every Job-derived output closed until the live audit and RG-381's
// per-Job completeness check have both been implemented and verified.
export function isJobDiaryCoverageVerified() {
  return false;
}

export const jobDiaryGateMessage =
  "The full ServiceM8 Job Diary has not been reconciled with authorised API reads. " +
  "No Job summary, email draft, or recommendation was generated. " +
  "Review the Job Diary in ServiceM8; this Office Assistant feature is awaiting the coverage audit.";
