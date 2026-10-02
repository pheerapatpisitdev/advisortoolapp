# Clip ffmpeg on AWS Lambda

The app invokes this function asynchronously with `{ id, job, uploads, callbackUrl, token }`. The function
downloads the job inputs (signed URLs), runs one ffmpeg command, PUTs each output to its signed upload URL, then
POSTs `{ id, token, state, outputs | error }` to `callbackUrl`. It needs **no AWS permissions of its own**.

## Before you start

- An AWS account, and the AWS CLI installed (`aws --version` works).
- Run `aws configure` once with the access key of an admin IAM user (not the root user) and region `ap-southeast-1`.
- Docker Desktop installed and **running** (`docker ps` works).

Do this once there is an AWS account. Replace `ACCOUNT_ID` with the 12-digit account id. Region: `ap-southeast-1`.

```bash
export AWS_REGION=ap-southeast-1
export ACCOUNT_ID=123456789012
export FN=clip-ffmpeg
export REPO=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$FN
```

## 1. Image to ECR

```bash
aws ecr create-repository --repository-name $FN --region $AWS_REGION
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

cd infra/lambda-ffmpeg
# ffmpeg 6.0.1 static build, checksum computed from the archive at
# https://johnvansickle.com/ffmpeg/old-releases/ffmpeg-6.0.1-amd64-static.tar.xz
# (to use another version: download it, run `shasum -a 256 <file>`, pass both --build-arg values)
docker build --platform linux/amd64 --provenance=false \
  --build-arg FFMPEG_VERSION=6.0.1 \
  --build-arg FFMPEG_SHA256=28268bf402f1083833ea269331587f60a242848880073be8016501d864bd07a5 \
  -t $FN .
docker tag $FN:latest $REPO:latest
docker push $REPO:latest
```

## 2. Execution role (logs only)

```bash
aws iam create-role --role-name $FN-exec \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name $FN-exec \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

Wait about 10 seconds before step 3. If `create-function` says "The role defined for the function cannot be assumed
by Lambda", wait a few more seconds and run it again.

## 3. The function

```bash
aws lambda create-function \
  --function-name $FN \
  --package-type Image \
  --code ImageUri=$REPO:latest \
  --role arn:aws:iam::$ACCOUNT_ID:role/$FN-exec \
  --architectures x86_64 \
  --memory-size 3008 \
  --ephemeral-storage Size=10240 \
  --timeout 900 \
  --region $AWS_REGION
```

Do not let AWS re-run a job on its own (a retry after a timeout would run after the app has already given up on it):

```bash
aws lambda put-function-event-invoke-config --function-name $FN --maximum-retry-attempts 0 --maximum-event-age-in-seconds 600 --region $AWS_REGION
```

New image later: push, then
`aws lambda update-function-code --function-name $FN --image-uri $REPO:latest --region $AWS_REGION`.

If the account refuses memory above 3008 MB, that is the new-account limit; 3008 is what this was sized for.

## 4. A key that can only invoke this function

```bash
aws iam create-user --user-name $FN-invoker
aws iam put-user-policy --user-name $FN-invoker --policy-name invoke-$FN \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"lambda:InvokeFunction","Resource":"arn:aws:lambda:ap-southeast-1:'$ACCOUNT_ID':function:'$FN'"}]}'
aws iam create-access-key --user-name $FN-invoker
```

The last command prints JSON with an `AccessKey` block. You need two fields: `AccessKeyId` and `SecretAccessKey`.
**The secret is shown only this once**; if you lose it, delete the key and create another. Never paste it in chat or
email.

## 5. Paste the key into the app

On `/admin/ai`, put the `aws` key as one line:

```
ACCESS_KEY_ID:SECRET:REGION:FUNCTION_NAME
```

that is `AccessKeyId`, `SecretAccessKey`, the region, and the function name (`clip-ffmpeg`), for example
`AKIA...:wJalr...:ap-southeast-1:clip-ffmpeg`. Four parts separated by `:`; none may be empty. The
secret is stored encrypted and never written to logs.

## 6. Check it

```bash
aws lambda get-function --function-name $FN --region $AWS_REGION --query 'Configuration.[State,MemorySize,Timeout,EphemeralStorage.Size]'
```

Expect `Active`, `3008`, `900`, `10240`. Logs of every render (including failures, by job id) are in CloudWatch:
AWS console, CloudWatch, Log groups, `/aws/lambda/clip-ffmpeg`.
