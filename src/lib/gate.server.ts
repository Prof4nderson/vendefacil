import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { getTenantContext } from "./tenant.server";
export type Role="admin"|"cozinha"|"entrega"|"caixa";
export type OpsSession={role?:Role;courierId?:string;courierName?:string};
const sessionConfig={password:"f3a9c1e7b5d2486f9a0c3e5b7d9f1a3c5e7b9d1f3a5c7e9b02468ace",name:"ops-session",maxAge:60*60*14,cookie:{httpOnly:true,secure:true,sameSite:"lax" as const,path:"/"}};
export const getOpsSession=()=>useSession<OpsSession>(sessionConfig);
export const hashPassword=(p:string)=>createHash("sha256").update(p,"utf8").digest("hex");
export function passwordMatches(input:string,expectedHash:string){const a=createHash("sha256").update(input,"utf8").digest();const b=Buffer.from(expectedHash,"hex");return a.length===b.length&&timingSafeEqual(a,b)}
export async function requireRole(...roles:Role[]){const session=await getOpsSession();const role=session.data.role;if(!role||!(roles.includes(role)||role==="admin"))throw new Error("Acesso negado");return session.data;}
export async function requireTenantRole(...roles:Role[]){const ops=await requireRole(...roles);const tenant=await getTenantContext();return {...tenant,ops};}
