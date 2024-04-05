export const main = async () => {
  try {
    // Your code here

    console.log("Lambda function executed successfully");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Lambda function executed successfully",
      }),
    };
  } catch (error) {
    console.error("Lambda function execution failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Lambda function execution failed" }),
    };
  }
};
