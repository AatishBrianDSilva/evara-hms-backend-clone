import { S3 } from 'aws-sdk';
//import env from '../config/evn.json';

const s3 = new S3({
    //region: env.aws_region_prod
    region: 'ap-south-1'
});

class S3Service {
    static async getObject(bucket: string, objectKey: string): Promise<string> {
        try {
            const params: AWS.S3.GetObjectRequest = {
                Bucket: bucket,
                Key: objectKey
            };

            const data = await s3.getObject(params).promise();
            if (data.Body !== undefined) {
                return data.Body.toString('utf-8');
            } else {
                throw new Error('S3 object body is undefined');
            }
        } catch (e: any) {
            throw new Error(`Could not retrieve file from S3: ${e.message}`);
        }
    }
}

export default S3Service;