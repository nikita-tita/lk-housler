"""Storage service implementation (S3/MinIO)"""

from typing import Optional
from io import BytesIO

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class StorageService:
    """S3/MinIO storage service"""

    def __init__(self):
        # Parse endpoint
        endpoint = settings.S3_ENDPOINT.replace("http://", "").replace("https://", "")
        secure = settings.S3_ENDPOINT.startswith("https://")

        self.client = Minio(
            endpoint, access_key=settings.S3_ACCESS_KEY, secret_key=settings.S3_SECRET_KEY, secure=secure
        )

        # Ensure buckets exist
        self._ensure_buckets()

    def _ensure_buckets(self):
        """Ensure required buckets exist"""
        buckets = [
            settings.S3_BUCKET_DOCUMENTS,
            settings.S3_BUCKET_RECEIPTS,
        ]

        for bucket in buckets:
            try:
                if not self.client.bucket_exists(bucket):
                    self.client.make_bucket(bucket)
            except S3Error as e:
                print(f"Error ensuring bucket {bucket}: {e}")

    async def upload(
        self, key: str, data: bytes, content_type: str = "application/octet-stream", bucket: Optional[str] = None
    ) -> str:
        """Upload file to storage"""
        bucket = bucket or settings.S3_BUCKET_DOCUMENTS

        try:
            self.client.put_object(bucket, key, BytesIO(data), length=len(data), content_type=content_type)

            # Return URL
            return f"{settings.S3_ENDPOINT}/{bucket}/{key}"
        except S3Error as e:
            raise Exception(f"Failed to upload file: {e}")

    async def download(self, key: str, bucket: Optional[str] = None) -> bytes:
        """Download file from storage"""
        bucket = bucket or settings.S3_BUCKET_DOCUMENTS

        try:
            response = self.client.get_object(bucket, key)
            return response.read()
        except S3Error as e:
            raise Exception(f"Failed to download file: {e}")

    async def delete(self, key: str, bucket: Optional[str] = None) -> bool:
        """Delete file from storage"""
        bucket = bucket or settings.S3_BUCKET_DOCUMENTS

        try:
            self.client.remove_object(bucket, key)
            return True
        except S3Error as e:
            print(f"Failed to delete file: {e}")
            return False

    async def get_url(self, key: str, bucket: Optional[str] = None, expires: int = 3600) -> str:
        """Get presigned URL for file access"""
        bucket = bucket or settings.S3_BUCKET_DOCUMENTS

        try:
            url = self.client.presigned_get_object(bucket, key, expires=expires)
            return url
        except S3Error as e:
            raise Exception(f"Failed to generate URL: {e}")
