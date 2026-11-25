-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('STANDARD', 'NORMAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ChangeState" AS ENUM ('DRAFT', 'SUBMITTED', 'ASSESSMENT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'IMPLEMENTING', 'IMPLEMENTED', 'FAILED', 'REJECTED', 'DEFERRED', 'CANCELLED', 'PENDING_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW');

-- CreateEnum
CREATE TYPE "ChangePriority" AS ENUM ('CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'PLANNING');

-- CreateEnum
CREATE TYPE "Probability" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('TECHNICAL', 'BUSINESS', 'APPLICATION_OWNER', 'INFRASTRUCTURE', 'SECURITY', 'CAB', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ApprovalDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO', 'DELEGATED');

-- CreateEnum
CREATE TYPE "ChangeApprovalStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('NOT_EXECUTED', 'PASSED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ImplementationOutcome" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILURE');

-- CreateEnum
CREATE TYPE "PirResult" AS ENUM ('SUCCESSFUL', 'PARTIAL', 'UNSUCCESSFUL');

-- CreateEnum
CREATE TYPE "ProblemState" AS ENUM ('NEW', 'ASSESSED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CabMeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CabDecisionType" AS ENUM ('APPROVE', 'REJECT', 'DEFER', 'MORE_INFO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleName" ADD VALUE 'CHANGE_MANAGER';
ALTER TYPE "RoleName" ADD VALUE 'CHANGE_REQUESTER';
ALTER TYPE "RoleName" ADD VALUE 'CHANGE_OWNER';
ALTER TYPE "RoleName" ADD VALUE 'TECHNICAL_APPROVER';
ALTER TYPE "RoleName" ADD VALUE 'BUSINESS_APPROVER';
ALTER TYPE "RoleName" ADD VALUE 'CAB_MEMBER';
ALTER TYPE "RoleName" ADD VALUE 'IMPLEMENTATION_LEAD';
ALTER TYPE "RoleName" ADD VALUE 'CHANGE_AUDITOR';

-- CreateTable
CREATE TABLE "problems" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "state" "ProblemState" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "change_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID,
    "implementation_plan" TEXT,
    "backout_plan" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "change_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ChangeType" NOT NULL,
    "category_id" UUID,
    "subcategory_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "requested_for_id" UUID,
    "business_justification" TEXT,
    "business_service_id" UUID,
    "configuration_item_id" UUID,
    "related_incident_id" UUID,
    "related_problem_id" UUID,
    "business_impact" "ImpactLevel",
    "technical_impact" "ImpactLevel",
    "urgency" "Urgency",
    "priority" "ChangePriority",
    "probability" "Probability",
    "impacted_users" INTEGER,
    "downtime_required" BOOLEAN NOT NULL DEFAULT false,
    "estimated_downtime_minutes" INTEGER,
    "risk_assessment_narrative" TEXT,
    "impact_analysis" TEXT,
    "assessment_summary" TEXT,
    "risk_level" "RiskLevel",
    "risk_score" DOUBLE PRECISION,
    "risk_explanation" TEXT,
    "planned_start" TIMESTAMP(3),
    "planned_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "maintenance_window_id" UUID,
    "assignment_group_id" UUID,
    "implementation_group_id" UUID,
    "change_owner_id" UUID,
    "implementation_lead_id" UUID,
    "change_coordinator_id" UUID,
    "assigned_to_id" UUID,
    "schedule_override_justification" TEXT,
    "schedule_override_by_id" UUID,
    "schedule_override_at" TIMESTAMP(3),
    "backout_required" BOOLEAN NOT NULL DEFAULT false,
    "backout_plan" TEXT,
    "backout_trigger_conditions" TEXT,
    "rollback_steps" TEXT,
    "rollback_duration_minutes" INTEGER,
    "rollback_owner_id" UUID,
    "approval_status" "ChangeApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "state" "ChangeState" NOT NULL DEFAULT 'DRAFT',
    "implementation_status" TEXT,
    "implementation_summary" TEXT,
    "implementation_outcome" "ImplementationOutcome",
    "service_impact_summary" TEXT,
    "issues_encountered" TEXT,
    "rollback_executed" BOOLEAN NOT NULL DEFAULT false,
    "resolution_details" TEXT,
    "pir_required" BOOLEAN NOT NULL DEFAULT false,
    "emergency_justification" TEXT,
    "test_plan" TEXT,
    "template_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_affected_cis" (
    "change_id" UUID NOT NULL,
    "configuration_item_id" UUID NOT NULL,

    CONSTRAINT "change_affected_cis_pkey" PRIMARY KEY ("change_id","configuration_item_id")
);

-- CreateTable
CREATE TABLE "change_affected_services" (
    "change_id" UUID NOT NULL,
    "business_service_id" UUID NOT NULL,

    CONSTRAINT "change_affected_services_pkey" PRIMARY KEY ("change_id","business_service_id")
);

-- CreateTable
CREATE TABLE "change_tasks" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT,
    "assignee_id" UUID,
    "assignment_group_id" UUID,
    "planned_start" TIMESTAMP(3),
    "planned_end" TIMESTAMP(3),
    "estimated_minutes" INTEGER,
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completion_comments" TEXT,

    CONSTRAINT "change_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_task_dependencies" (
    "task_id" UUID NOT NULL,
    "depends_on_id" UUID NOT NULL,

    CONSTRAINT "change_task_dependencies_pkey" PRIMARY KEY ("task_id","depends_on_id")
);

-- CreateTable
CREATE TABLE "change_test_cases" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "expected_results" TEXT NOT NULL,
    "validation_criteria" TEXT,
    "owner_id" UUID,
    "actual_results" TEXT,
    "status" "TestStatus" NOT NULL DEFAULT 'NOT_EXECUTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_approvals" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "approval_type" "ApprovalType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "ApprovalDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "approver_id" UUID,
    "delegated_to_id" UUID,
    "decided_by_id" UUID,
    "comments" TEXT,
    "due_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "required_role" "RoleName" NOT NULL,

    CONSTRAINT "change_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_notes" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_history" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "comment" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_pirs" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "conducted_by_id" UUID,
    "conducted_at" TIMESTAMP(3),
    "expected_vs_actual" TEXT,
    "disruption" TEXT,
    "customer_impact" TEXT,
    "success_criteria_met" BOOLEAN,
    "lessons_learned" TEXT,
    "result" "PirResult",

    CONSTRAINT "change_pirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pir_actions" (
    "id" UUID NOT NULL,
    "pir_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "owner_id" UUID,
    "due_at" TIMESTAMP(3),

    CONSTRAINT "pir_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "min_risk" "RiskLevel",
    "max_risk" "RiskLevel",
    "mode" "ApprovalMode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allow_self_approval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policy_steps" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "approval_type" "ApprovalType" NOT NULL,
    "required_role" "RoleName" NOT NULL,
    "assignment_group_id" UUID,
    "deadline_hours" INTEGER,

    CONSTRAINT "approval_policy_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_engine_config" (
    "id" TEXT NOT NULL,
    "impact_weight" DOUBLE PRECISION NOT NULL,
    "probability_weight" DOUBLE PRECISION NOT NULL,
    "downtime_weight" DOUBLE PRECISION NOT NULL,
    "user_impact_weight" DOUBLE PRECISION NOT NULL,
    "very_high_min" DOUBLE PRECISION NOT NULL,
    "high_min" DOUBLE PRECISION NOT NULL,
    "medium_min" DOUBLE PRECISION NOT NULL,
    "low_min" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "risk_engine_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_factor_scores" (
    "id" UUID NOT NULL,
    "factor_type" TEXT NOT NULL,
    "factor_value" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "risk_factor_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_user_bands" (
    "id" UUID NOT NULL,
    "min_users" INTEGER NOT NULL,
    "max_users" INTEGER,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "risk_user_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_level_ranks" (
    "level" "RiskLevel" NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "risk_level_ranks_pkey" PRIMARY KEY ("level")
);

-- CreateTable
CREATE TABLE "change_priority_matrix" (
    "id" UUID NOT NULL,
    "impact" "ImpactLevel" NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "priority" "ChangePriority" NOT NULL,

    CONSTRAINT "change_priority_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_state_rules" (
    "id" UUID NOT NULL,
    "from_state" "ChangeState" NOT NULL,
    "to_state" "ChangeState" NOT NULL,
    "guard" TEXT NOT NULL,
    "allowed_roles" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "change_state_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rollback_requirements" (
    "id" UUID NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "risk" "RiskLevel" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rollback_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_type_policies" (
    "change_type" "ChangeType" NOT NULL,
    "requires_assessment" BOOLEAN NOT NULL DEFAULT true,
    "pir_required" BOOLEAN NOT NULL DEFAULT false,
    "pir_min_risk" "RiskLevel",
    "early_implement_roles" TEXT NOT NULL DEFAULT 'ITSM_ADMINISTRATOR|CHANGE_MANAGER',
    "allow_self_approval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "change_type_policies_pkey" PRIMARY KEY ("change_type")
);

-- CreateTable
CREATE TABLE "cab_meetings" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "CabMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minutes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cab_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cab_meeting_members" (
    "meeting_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "cab_meeting_members_pkey" PRIMARY KEY ("meeting_id","user_id")
);

-- CreateTable
CREATE TABLE "cab_agenda_items" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "summary" TEXT,
    "decision" "CabDecisionType",
    "comments" TEXT,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "cab_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cab_decisions" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "decision" "CabDecisionType" NOT NULL,
    "comments" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cab_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_windows" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "configuration_item_id" UUID,
    "business_service_id" UUID,

    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blackout_periods" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "configuration_item_id" UUID,
    "business_service_id" UUID,

    CONSTRAINT "blackout_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_attachments" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "task_id" UUID,
    "test_case_id" UUID,
    "approval_id" UUID,
    "pir_id" UUID,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "user_id" UUID NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "problems_number_key" ON "problems"("number");

-- CreateIndex
CREATE INDEX "change_categories_parent_id_idx" ON "change_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_templates_name_key" ON "change_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "change_requests_number_key" ON "change_requests"("number");

-- CreateIndex
CREATE INDEX "change_requests_state_idx" ON "change_requests"("state");

-- CreateIndex
CREATE INDEX "change_requests_type_idx" ON "change_requests"("type");

-- CreateIndex
CREATE INDEX "change_requests_risk_level_idx" ON "change_requests"("risk_level");

-- CreateIndex
CREATE INDEX "change_requests_priority_idx" ON "change_requests"("priority");

-- CreateIndex
CREATE INDEX "change_requests_approval_status_idx" ON "change_requests"("approval_status");

-- CreateIndex
CREATE INDEX "change_requests_planned_start_idx" ON "change_requests"("planned_start");

-- CreateIndex
CREATE INDEX "change_requests_planned_end_idx" ON "change_requests"("planned_end");

-- CreateIndex
CREATE INDEX "change_requests_created_at_idx" ON "change_requests"("created_at");

-- CreateIndex
CREATE INDEX "change_requests_updated_at_idx" ON "change_requests"("updated_at");

-- CreateIndex
CREATE INDEX "change_requests_assignment_group_id_idx" ON "change_requests"("assignment_group_id");

-- CreateIndex
CREATE INDEX "change_requests_requested_by_id_idx" ON "change_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "change_requests_assigned_to_id_idx" ON "change_requests"("assigned_to_id");

-- CreateIndex
CREATE INDEX "change_requests_related_incident_id_idx" ON "change_requests"("related_incident_id");

-- CreateIndex
CREATE INDEX "change_requests_related_problem_id_idx" ON "change_requests"("related_problem_id");

-- CreateIndex
CREATE INDEX "change_tasks_change_id_idx" ON "change_tasks"("change_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_tasks_change_id_number_key" ON "change_tasks"("change_id", "number");

-- CreateIndex
CREATE INDEX "change_test_cases_change_id_idx" ON "change_test_cases"("change_id");

-- CreateIndex
CREATE INDEX "change_approvals_change_id_sequence_idx" ON "change_approvals"("change_id", "sequence");

-- CreateIndex
CREATE INDEX "change_notes_change_id_created_at_idx" ON "change_notes"("change_id", "created_at");

-- CreateIndex
CREATE INDEX "change_history_change_id_created_at_idx" ON "change_history"("change_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "change_pirs_change_id_key" ON "change_pirs"("change_id");

-- CreateIndex
CREATE INDEX "pir_actions_pir_id_idx" ON "pir_actions"("pir_id");

-- CreateIndex
CREATE INDEX "approval_policies_change_type_is_active_idx" ON "approval_policies"("change_type", "is_active");

-- CreateIndex
CREATE INDEX "approval_policy_steps_policy_id_sequence_idx" ON "approval_policy_steps"("policy_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "risk_factor_scores_factor_type_factor_value_key" ON "risk_factor_scores"("factor_type", "factor_value");

-- CreateIndex
CREATE UNIQUE INDEX "change_priority_matrix_impact_urgency_key" ON "change_priority_matrix"("impact", "urgency");

-- CreateIndex
CREATE UNIQUE INDEX "change_state_rules_from_state_to_state_key" ON "change_state_rules"("from_state", "to_state");

-- CreateIndex
CREATE UNIQUE INDEX "rollback_requirements_change_type_risk_key" ON "rollback_requirements"("change_type", "risk");

-- CreateIndex
CREATE UNIQUE INDEX "cab_meetings_number_key" ON "cab_meetings"("number");

-- CreateIndex
CREATE UNIQUE INDEX "cab_agenda_items_meeting_id_change_id_key" ON "cab_agenda_items"("meeting_id", "change_id");

-- CreateIndex
CREATE INDEX "cab_decisions_change_id_idx" ON "cab_decisions"("change_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_attachments_storage_key_key" ON "change_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "change_attachments_change_id_idx" ON "change_attachments"("change_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "change_categories" ADD CONSTRAINT "change_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "change_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_templates" ADD CONSTRAINT "change_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "change_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "change_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "change_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_for_id_fkey" FOREIGN KEY ("requested_for_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_business_service_id_fkey" FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_configuration_item_id_fkey" FOREIGN KEY ("configuration_item_id") REFERENCES "configuration_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_related_incident_id_fkey" FOREIGN KEY ("related_incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_related_problem_id_fkey" FOREIGN KEY ("related_problem_id") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_assignment_group_id_fkey" FOREIGN KEY ("assignment_group_id") REFERENCES "assignment_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_implementation_group_id_fkey" FOREIGN KEY ("implementation_group_id") REFERENCES "assignment_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_change_owner_id_fkey" FOREIGN KEY ("change_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_implementation_lead_id_fkey" FOREIGN KEY ("implementation_lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_change_coordinator_id_fkey" FOREIGN KEY ("change_coordinator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_schedule_override_by_id_fkey" FOREIGN KEY ("schedule_override_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_rollback_owner_id_fkey" FOREIGN KEY ("rollback_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "change_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_maintenance_window_id_fkey" FOREIGN KEY ("maintenance_window_id") REFERENCES "maintenance_windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_affected_cis" ADD CONSTRAINT "change_affected_cis_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_affected_cis" ADD CONSTRAINT "change_affected_cis_configuration_item_id_fkey" FOREIGN KEY ("configuration_item_id") REFERENCES "configuration_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_affected_services" ADD CONSTRAINT "change_affected_services_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_affected_services" ADD CONSTRAINT "change_affected_services_business_service_id_fkey" FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_tasks" ADD CONSTRAINT "change_tasks_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_tasks" ADD CONSTRAINT "change_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_tasks" ADD CONSTRAINT "change_tasks_assignment_group_id_fkey" FOREIGN KEY ("assignment_group_id") REFERENCES "assignment_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_task_dependencies" ADD CONSTRAINT "change_task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "change_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_task_dependencies" ADD CONSTRAINT "change_task_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "change_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_test_cases" ADD CONSTRAINT "change_test_cases_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_test_cases" ADD CONSTRAINT "change_test_cases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_approvals" ADD CONSTRAINT "change_approvals_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_approvals" ADD CONSTRAINT "change_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_approvals" ADD CONSTRAINT "change_approvals_delegated_to_id_fkey" FOREIGN KEY ("delegated_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_approvals" ADD CONSTRAINT "change_approvals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_notes" ADD CONSTRAINT "change_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_pirs" ADD CONSTRAINT "change_pirs_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_pirs" ADD CONSTRAINT "change_pirs_conducted_by_id_fkey" FOREIGN KEY ("conducted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pir_actions" ADD CONSTRAINT "pir_actions_pir_id_fkey" FOREIGN KEY ("pir_id") REFERENCES "change_pirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pir_actions" ADD CONSTRAINT "pir_actions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policy_steps" ADD CONSTRAINT "approval_policy_steps_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policy_steps" ADD CONSTRAINT "approval_policy_steps_assignment_group_id_fkey" FOREIGN KEY ("assignment_group_id") REFERENCES "assignment_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_meetings" ADD CONSTRAINT "cab_meetings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_meeting_members" ADD CONSTRAINT "cab_meeting_members_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "cab_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_meeting_members" ADD CONSTRAINT "cab_meeting_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_agenda_items" ADD CONSTRAINT "cab_agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "cab_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_agenda_items" ADD CONSTRAINT "cab_agenda_items_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_agenda_items" ADD CONSTRAINT "cab_agenda_items_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_decisions" ADD CONSTRAINT "cab_decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "cab_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_decisions" ADD CONSTRAINT "cab_decisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_windows" ADD CONSTRAINT "maintenance_windows_configuration_item_id_fkey" FOREIGN KEY ("configuration_item_id") REFERENCES "configuration_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_windows" ADD CONSTRAINT "maintenance_windows_business_service_id_fkey" FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blackout_periods" ADD CONSTRAINT "blackout_periods_configuration_item_id_fkey" FOREIGN KEY ("configuration_item_id") REFERENCES "configuration_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blackout_periods" ADD CONSTRAINT "blackout_periods_business_service_id_fkey" FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_attachments" ADD CONSTRAINT "change_attachments_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_attachments" ADD CONSTRAINT "change_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
