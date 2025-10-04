import { prisma } from "@/lib/db";
import { decryptEnvVars } from "@/lib/crypto";
import { dockerManager } from "@/lib/docker/manager";

export interface ExecutionRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryParams?: Record<string, string>;
}

export interface ExecutionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  duration: number;
  memoryUsed?: number;
  error?: string;
  errorStack?: string;
}

export class EdgeFunctionExecutor {
  /**
   * Execute an edge function
   */
  async execute(
    functionId: string,
    request: ExecutionRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ExecutionResponse> {
    const startTime = Date.now();
    let error: string | undefined;
    let errorStack: string | undefined;
    let statusCode = 200;
    let responseBody = "";
    let responseHeaders: Record<string, string> = {};

    try {
      // Load function from database
      const func = await prisma.edgeFunction.findUnique({
        where: { id: functionId },
      });

      if (!func) {
        throw new Error("Function not found");
      }

      if (func.status !== "ACTIVE") {
        throw new Error(`Function is ${func.status.toLowerCase()}`);
      }

      // Decrypt environment variables
      const envVars = func.envVars ? decryptEnvVars(func.envVars) : {};

      // Execute the function in container
      const result = await this.executeInContainer(func, request, envVars);

      statusCode = result.statusCode;
      responseBody = result.body;
      responseHeaders = result.headers;

      // Update function metrics
      await prisma.edgeFunction.update({
        where: { id: functionId },
        data: {
          lastInvokedAt: new Date(),
          invocationCount: { increment: 1 },
        },
      });
    } catch (err: any) {
      error = err.message;
      errorStack = err.stack;
      statusCode = 500;
      responseBody = JSON.stringify({ error: err.message });

      // Update error count
      await prisma.edgeFunction.update({
        where: { id: functionId },
        data: {
          errorCount: { increment: 1 },
        },
      }).catch(() => {});
    }

    const duration = Date.now() - startTime;

    // Record invocation
    await prisma.functionInvocation.create({
      data: {
        functionId,
        method: request.method,
        path: request.path,
        headers: JSON.stringify(request.headers),
        body: request.body,
        queryParams: JSON.stringify(request.queryParams),
        statusCode,
        responseBody,
        responseHeaders: JSON.stringify(responseHeaders),
        duration,
        error,
        errorStack,
        ipAddress,
        userAgent,
      },
    }).catch((err) => {
      console.error("Failed to record invocation:", err);
    });

    return {
      statusCode,
      headers: responseHeaders,
      body: responseBody,
      duration,
      error,
      errorStack,
    };
  }

  /**
   * Execute function code in container
   */
  private async executeInContainer(
    func: any,
    request: ExecutionRequest,
    envVars: Record<string, string>
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
    // Prepare request object
    const requestData = {
      method: request.method,
      url: request.path,
      headers: request.headers,
      body: request.body,
      query: request.queryParams || {},
    };

    // Transform code to remove ES6 module syntax
    let transformedCode = func.code;
    
    // Remove export default and export statements
    transformedCode = transformedCode.replace(/export\s+default\s+/g, '');
    transformedCode = transformedCode.replace(/export\s+/g, '');
    
    // Execute in Node.js VM (temporary solution until Docker runtime is ready)
    try {
      const vm = require('vm');
      
      // Create sandbox with limited globals
      const sandbox = {
        console,
        JSON,
        fetch,
        env: envVars,
        request: requestData,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Promise,
        Buffer,
        URL,
        URLSearchParams,
      };
      
      // Create context
      const context = vm.createContext(sandbox);
      
      // Execute code with timeout
      const script = new vm.Script(`
        ${transformedCode}
        
        // Execute handler
        (async () => {
          return await ${func.handler}(request);
        })();
      `);
      
      const resultPromise = script.runInContext(context, {
        timeout: func.timeout,
        displayErrors: true,
      });
      
      const result = await resultPromise;
      
      // Normalize response
      if (typeof result === 'string') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: result,
        };
      }
      
      return {
        statusCode: result.statusCode || 200,
        headers: result.headers || { 'Content-Type': 'application/json' },
        body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body || result),
      };
    } catch (error: any) {
      throw new Error(`Execution error: ${error.message}`);
    }
  }

  /**
   * Test execute a function (without recording invocation)
   */
  async testExecute(
    functionId: string,
    request: ExecutionRequest
  ): Promise<ExecutionResponse> {
    const startTime = Date.now();

    try {
      const func = await prisma.edgeFunction.findUnique({
        where: { id: functionId },
      });

      if (!func) {
        throw new Error("Function not found");
      }

      const envVars = func.envVars ? decryptEnvVars(func.envVars) : {};
      const result = await this.executeInContainer(func, request, envVars);

      return {
        statusCode: result.statusCode,
        headers: result.headers,
        body: result.body,
        duration: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: err.message }),
        duration: Date.now() - startTime,
        error: err.message,
        errorStack: err.stack,
      };
    }
  }
}

// Singleton instance
export const edgeFunctionExecutor = new EdgeFunctionExecutor();
