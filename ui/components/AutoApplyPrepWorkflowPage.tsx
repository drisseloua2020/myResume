import React from 'react';
import JobsWorkbench from './JobsWorkbench';
export default function AutoApplyPrepWorkflowPage({ onOpenApproval }: { onOpenApproval: () => void }) {
  return <JobsWorkbench mode="prepare" onNext={onOpenApproval} />;
}
