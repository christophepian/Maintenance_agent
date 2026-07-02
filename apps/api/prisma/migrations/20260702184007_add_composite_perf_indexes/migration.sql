-- CreateIndex
CREATE INDEX "Invoice_orgId_status_idx" ON "Invoice"("orgId", "status");

-- CreateIndex
CREATE INDEX "Job_orgId_status_idx" ON "Job"("orgId", "status");

-- CreateIndex
CREATE INDEX "Lease_orgId_status_idx" ON "Lease"("orgId", "status");

-- CreateIndex
CREATE INDEX "Request_orgId_status_idx" ON "Request"("orgId", "status");

-- CreateIndex
CREATE INDEX "Unit_orgId_isVacant_idx" ON "Unit"("orgId", "isVacant");
