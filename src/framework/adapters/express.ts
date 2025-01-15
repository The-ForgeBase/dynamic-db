import type { RequestAdapter } from "./types.js";
import type { Request } from "express";

export class ExpressAdapter implements RequestAdapter {
  async getBody<T>(request: Request): Promise<T> {
    return request.body;
  }

  getQuery(request: Request): Record<string, any> {
    return request.query;
  }

  getParams(request: Request): Record<string, any> {
    return request.params;
  }

  getHeaders(request: Request): Record<string, string> {
    return request.headers as Record<string, string>;
  }
}
