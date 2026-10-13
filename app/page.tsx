import { getConfig } from "@/lib/config";
import { ADDON_VERSION, addonName } from "@/lib/servicem8/addon-metadata";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function Home() {
  const config = getConfig();
  const name = addonName(config.appBaseUrl);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="page-title">
        <div className={styles.headingRow}>
          <div>
            <h1 id="page-title">{name}</h1>
            <p className={styles.intro}>
              Bounded read-only conversation. Launch it globally from the authorised Add-ons menu.
            </p>
          </div>
          <span className={styles.environment}>{name.endsWith("Staging") ? "Staging" : "Production"}</span>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>Add-on name</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Manifest version</dt>
            <dd>{ADDON_VERSION}</dd>
          </div>
          <div className={styles.wide}>
            <dt>OAuth scopes</dt>
            <dd className={styles.scope}>{config.oauthScopes}</dd>
          </div>
          <div>
            <dt>Launch mode</dt>
            <dd>Global Add-ons menu</dd>
          </div>
          <div>
            <dt>Job Actions</dt>
            <dd>Disabled</dd>
          </div>
          <div>
            <dt>“What happened?” proof</dt>
            <dd>{config.assistantProof.enabled ? "Enabled" : "Disabled"}</dd>
          </div>
          <div>
            <dt>Email Draft proof</dt>
            <dd>{config.assistantProof.enabled ? "Enabled" : "Disabled"}</dd>
          </div>
          <div>
            <dt>Phase 1 conversation</dt>
            <dd>{config.assistantProof.enabled ? "Enabled" : "Disabled"}</dd>
          </div>
        </dl>

        <p className={styles.note}>
          This status page contains configuration details only. It does not display or retrieve Job information.
        </p>
      </section>
    </main>
  );
}
