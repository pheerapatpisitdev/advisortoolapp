#!/bin/bash
# stats.sh EXECUTION : the execution's billed span (start → completion) and the renderer's own result line
ex=$1
gcloud run jobs executions describe $ex --region asia-southeast1 --format="value(status.startTime,status.completionTime,status.succeededCount)"
gcloud logging read "resource.type=\"cloud_run_job\" AND labels.\"run.googleapis.com/execution_name\"=\"$ex\"" --limit 60 --format="value(textPayload)" --order=asc | grep -E '"done"|browser ready|render 0%|render done|uploaded|rror' 
