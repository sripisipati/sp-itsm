export interface Person {
  id: string;
  name: string;
  email?: string;
}

export interface IncidentListItem {
  id: string;
  ticketNumber: string;
  shortDescription: string;
  severity: string;
  priority: string;
  assignedTo: Person | null;
  assignedOn: string | null;
  status: string;
  createdBy: Person | null;
  createdAt: string;
  updatedBy: Person | null;
  updatedAt: string;
  version: number;
}

export interface IncidentNote {
  id: string;
  incidentId: string;
  noteType: "WORK_NOTE" | "ADDITIONAL_COMMENT";
  content: string;
  createdAt: string;
  createdBy: Person | null;
}

export interface IncidentDetail extends IncidentListItem {
  description: string;
  contactInformation: string | null;
  affectedLocation: string | null;
  impact: string;
  urgency: string;
  impactedUsers: number;
  resolutionCode: string | null;
  resolutionNotes: string | null;
  resolvedOn: string | null;
  caller: Person | null;
  resolvedBy: Person | null;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null;
  configurationItem: { id: string; name: string } | null;
  businessService: { id: string; name: string } | null;
  assignmentGroup: { id: string; name: string } | null;
  categoryId: string | null;
  subcategoryId: string | null;
  callerId: string | null;
  configurationItemId: string | null;
  businessServiceId: string | null;
  assignmentGroupId: string | null;
  assignedToId: string | null;
  notes: IncidentNote[];
  attachments: Array<{ id: string; fileName: string; contentType: string; fileSize: number; uploadedAt: string; uploadedBy: Person | null }>;
  history: Array<{ id: string; fieldName: string; oldValue: string | null; newValue: string | null; actionType: string; changedAt: string; changedBy: Person | null }>;
  activity: Array<{ id: string; type: string; summary: string; detail?: string; occurredAt: string; actor: Person | null }>;
  relatedChanges?: Array<{ id: string; number: string; shortDescription: string; state: string; type: string }>;
  allowedTransitions: string[];
  permissions: {
    canEdit: boolean;
    canAssign: boolean;
    canUpdateStatus: boolean;
    canResolve: boolean;
    canClose: boolean;
    canCancel: boolean;
    canAddWorkNote: boolean;
    canAddComment: boolean;
    canUpload: boolean;
  };
}

export interface PageResult<T> {
  data: T[];
  pagination: { page: number; pageSize: number; totalRecords: number; totalPages: number };
}
