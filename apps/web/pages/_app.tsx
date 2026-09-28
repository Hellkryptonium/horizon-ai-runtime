import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { isUnauthorized, useCurrentUserQuery } from "../lib/query";
import "../styles/globals.css";
import "../styles/public.css";

export default function App({ Component, pageProps, router }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const publicPage = ["/", "/login", "/register", "/developer", "/privacy", "/terms", "/cookies", "/404"].includes(router.pathname);
  return <QueryClientProvider client={queryClient}><Head><link rel="icon" href="/logo.png" /><meta name="theme-color" content="#101828" /></Head><AuthGate publicPage={publicPage}><Component {...pageProps} /></AuthGate></QueryClientProvider>;
}

function AuthGate({ publicPage, children }: { publicPage: boolean; children: ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, error } = useCurrentUserQuery(true);
  useEffect(() => {
    if (isLoading) return;
    if (!publicPage && isUnauthorized(error)) void router.replace("/login");
  }, [error, isLoading, publicPage, router, user]);
  if (publicPage) return <>{children}</>;
  if (isLoading) return <div className="auth-loading">Checking session...</div>;
  if (!publicPage && isUnauthorized(error)) return null;
  return <DashboardLayout>{children}</DashboardLayout>;
}
