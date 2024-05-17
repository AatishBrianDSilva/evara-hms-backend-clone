import { S3, AWSError } from "aws-sdk";

// Instantiate the S3 object with your desired region.
const s3 = new S3({
  region: "ap-south-1",
});

// Define a class to handle interactions with S3.
class S3Service {
  /**
   * Retrieves an object from the specified S3 bucket.
   * @param bucket The name of the bucket.
   * @param objectKey The key of the object within the bucket.
   * @returns The content of the object as a string.
   * @throws If the object cannot be retrieved or if the body is undefined.
   */
  static async getObject(bucket: string, objectKey: string): Promise<string> {
    try {
      // Define the parameters for the getObject request.
      const params: S3.GetObjectRequest = {
        Bucket: bucket,
        Key: objectKey,
      };

      // Perform the getObject request.
      const data = await s3.getObject(params).promise();

      // Ensure the object body is defined.
      if (data.Body) {
        return data.Body.toString("utf-8");
      } else {
        throw new Error("S3 object body is undefined");
      }
    } catch (err) {
      const e = err as AWSError;
      // Re-throw the error with additional context.
      throw new Error(`Could not retrieve file from S3: ${e.message}`);
    }
  }

  /**
   * Retrieves the tags for an object stored in an S3 bucket.
   * @param bucket The name of the bucket.
   * @param objectKey The key of the object within the bucket.
   * @returns An array of tags associated with the object.
   * @throws If the tags cannot be retrieved.
   */
  static async getTags(bucket: string, objectKey: string): Promise<S3.TagSet> {
    try {
      const params: S3.GetObjectTaggingRequest = {
        Bucket: bucket,
        Key: objectKey,
      };

      const data = await s3.getObjectTagging(params).promise();
      return data.TagSet;
    } catch (err) {
      const e = err as AWSError;
      throw new Error(`Could not retrieve tags from S3 object: ${e.message}`);
    }
  }

  /**
   * Retrieves the tags for an object stored in an S3 bucket.
   * @param bucket The name of the bucket.
   * @param objectKey The key of the object within the bucket.
   * @package tags An array of tags to associate with the object.
   * @returns An array of tags associated with the object.
   * @throws If the tags cannot be retrieved.
   */
  static async putTag(
    bucket: string,
    objectKey: string,
    tags: S3.TagSet
  ): Promise<void> {
    try {
      const params: S3.PutObjectTaggingRequest = {
        Bucket: bucket,
        Key: objectKey,
        Tagging: {
          TagSet: tags,
        },
      };

      await s3.putObjectTagging(params).promise();
    } catch (err) {
      const e = err as AWSError;
      throw new Error(`Could not update tags from S3 object: ${e.message}`);
    }
  }

  /**
   *
   * @param bucket The name of the bucket.
   * @param objectKey The key of the object within the bucket.
   * @returns void
   * @throws If the object cannot be deleted.
   */
  static async deleteObject(bucket: string, objectKey: string): Promise<void> {
    try {
      const params: S3.DeleteObjectRequest = {
        Bucket: bucket,
        Key: objectKey,
      };

      await s3.deleteObject(params).promise();
    } catch (err) {
      const e = err as AWSError;
      throw new Error(`Could not delete object from S3: ${e.message}`);
    }
  }

  /**
   * Generates a pre-signed URL for an S3 object.
   * @param bucket The name of the bucket.
   * @param objectKey The key of the object within the bucket.
   * @param expires How long until the pre-signed URL expires, in seconds.
   * @param operation The operation to perform on the object (e.g., getObject, putObject).
   * @param filePublic Whether the file should be publicly accessible.
   * @returns A pre-signed URL string.
   * @throws If the object cannot be retrieved or if the body is undefined.
   */
  static async generatePresignedUrl(
    bucket: string,
    objectKey: string,
    expires: number = 600,
    operation: "putObject" | "getObject" = "getObject",
    filePublic = false
  ): Promise<string> {
    try {
      const params: any = {
        Bucket: bucket,
        Key: objectKey,
        Expires: expires,
      };

      if (filePublic) {
        params["ACL"] = "public-read";
      }

      const res = await s3.getSignedUrlPromise(operation, params);
      return res;
    } catch (err) {
      const e = err as AWSError;
      throw new Error(`Could not generate pre-signed URL: ${e.message}`);
    }
  }
}

// Export the S3Service class.
export default S3Service;
