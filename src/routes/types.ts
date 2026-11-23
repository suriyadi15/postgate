export type RouteHandler = (input: { params: Record<string, string>; body: unknown }) => Promise<unknown>;
export type Routes = Record<string, Partial<Record<'GET' | 'POST' | 'DELETE', RouteHandler>>>;
