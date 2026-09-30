import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button, PageHeader } from "../components/ui/Primitives";
import { Input } from "../components/ui/Input";
import { useApiKeysQuery, useCreateApiKeyMutation, useCurrentUserQuery, useDeleteAccountMutation, useRevokeApiKeyMutation, useUpdateAccountMutation } from "../lib/query";

export default function Settings() {
  const router = useRouter();
  const { data: user, isLoading, isError } = useCurrentUserQuery();
  const updateAccount = useUpdateAccountMutation();
  const deleteAccount = useDeleteAccountMutation();
  const { data: apiKeys = [], isLoading: apiKeysLoading } = useApiKeysQuery();
  const createApiKey = useCreateApiKeyMutation();
  const revokeApiKey = useRevokeApiKeyMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [keyName, setKeyName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    try {
      await updateAccount.mutateAsync({ name, email });
      setMessage("Account details updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account details could not be updated.");
    }
  };

  const removeAccount = async () => {
    if (!window.confirm("Delete your Horizon account and its deployments? This cannot be undone.")) return;
    setMessage("");
    try {
      await deleteAccount.mutateAsync();
      await router.push("/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account could not be deleted.");
    }
  };

  const createKey = async () => {
    if (!keyName.trim()) return;
    const result = await createApiKey.mutateAsync(keyName.trim());
    setNewToken(result.token);
    setKeyName("");
  };

  return <div style={{ maxWidth: 760 }}>
    <PageHeader title="Settings" description="Manage your workspace account." />
    <section className="panel settings-card">
      <h2 className="content-title">Account details</h2>
      {isLoading ? <p style={{ color: "var(--muted)" }}>Loading account...</p> : isError || !user ? <p style={{ color: "var(--danger)" }}>Unable to load account details.</p> : <form onSubmit={saveAccount}>
        <div className="settings-grid">
          <div><label className="form-label" htmlFor="account-name">Name</label><Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div><label className="form-label" htmlFor="account-email">Email</label><Input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
        </div>
        <div className="wizard-actions"><button className="button primary" type="submit" disabled={updateAccount.isPending}>{updateAccount.isPending ? "Saving..." : "Save changes"}</button></div>
      </form>}
      {message && <div className={`inline-state ${deleteAccount.isError || updateAccount.isError ? "error" : ""}`}>{message}</div>}
    </section>
      <section className="panel settings-card">
        <h2 className="content-title">API keys</h2>
        <p style={{ color: "var(--muted)" }}>Use a key to call the public inference API. The full key is shown only once.</p><div style={{ marginBottom: 14 }}><Button href="/operations" variant="secondary">Open inference operations</Button></div>
        <div className="inline-actions"><Input aria-label="API key name" placeholder="Production app" value={keyName} onChange={(event) => setKeyName(event.target.value)} /><button className="button primary" type="button" onClick={() => void createKey()} disabled={createApiKey.isPending || !keyName.trim()}>{createApiKey.isPending ? "Creating..." : "Create key"}</button></div>
        {newToken && <div className="inline-state" style={{ marginTop: 12, overflowWrap: "anywhere" }}>Copy this key now: <strong>{newToken}</strong></div>}
        {apiKeysLoading ? <p style={{ color: "var(--muted)" }}>Loading keys...</p> : apiKeys.length === 0 ? <p style={{ color: "var(--muted)" }}>No API keys yet.</p> : <div>{apiKeys.map((key) => <div className="copy-row" key={key.id}><span><strong>{key.name}</strong> <small>{key.prefix}...</small></span><button className="button quiet danger-text" type="button" onClick={() => { if (window.confirm(`Revoke ${key.name}?`)) revokeApiKey.mutate(key.id); }}>Revoke</button></div>)}</div>}
      </section>
    <section className="panel settings-card danger-zone">
      <h2 className="content-title">Delete account</h2>
      <p style={{ color: "var(--muted)" }}>Permanently remove your account, deployments, and workspace data.</p>
      <button className="button danger" type="button" onClick={() => void removeAccount()} disabled={deleteAccount.isPending}>{deleteAccount.isPending ? "Deleting..." : "Delete account"}</button>
    </section>
  </div>;
}
