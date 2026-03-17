-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
