import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

SUPABASE_BUCKET = "athalink-images"
B2_BUCKET = "athalink-backup"

SUPABASE_ACCESS_KEY = os.environ["SUPABASE_ACCESS_KEY"]
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]

B2_KEY_ID = os.environ["B2_KEY_ID"]
B2_APPLICATION_KEY = os.environ["B2_APPLICATION_KEY"]

supabase_s3 = boto3.client(
    "s3",
    endpoint_url="https://nnhmiokeizmfmkvdqrvi.storage.supabase.co/storage/v1/s3",
    region_name="us-east-2",
    aws_access_key_id=SUPABASE_ACCESS_KEY,
    aws_secret_access_key=SUPABASE_SECRET_KEY,
    config=Config(signature_version="s3v4"),
)

b2_s3 = boto3.client(
    "s3",
    endpoint_url="https://s3.us-east-005.backblazeb2.com",
    region_name="us-east-005",
    aws_access_key_id=B2_KEY_ID,
    aws_secret_access_key=B2_APPLICATION_KEY,
    config=Config(signature_version="s3v4"),
)

def exists_in_b2(bucket, key, size):
    try:
        res = b2_s3.head_object(Bucket=bucket, Key=key)
        return res.get("ContentLength", -1) == size
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return False
        raise

def transfer_stream(key):
    response = supabase_s3.get_object(Bucket=SUPABASE_BUCKET, Key=key)
    b2_s3.upload_fileobj(response["Body"], B2_BUCKET, key)

def backup_all():
    paginator = supabase_s3.get_paginator("list_objects_v2")

    uploaded = 0
    skipped = 0
    failed = 0

    for page in paginator.paginate(Bucket=SUPABASE_BUCKET):
        for obj in page.get("Contents", []):
            key = obj["Key"]

            if not key or key.endswith("/") or key == ".emptyFolderPlaceholder":
                print(f"Skipping: {key}")
                skipped += 1
                continue

            try:
                size = obj.get("Size", 0)

                if exists_in_b2(B2_BUCKET, key, size):
                    print(f"Skipping unchanged: {key}")
                    skipped += 1
                    continue

                print(f"Backing up: {key}")
                transfer_stream(key)
                uploaded += 1

            except Exception as e:
                print(f"Failed: {key} -> {e}")
                failed += 1

    print(f"Done. Uploaded={uploaded}, Skipped={skipped}, Failed={failed}")

if __name__ == "__main__":
    backup_all()
