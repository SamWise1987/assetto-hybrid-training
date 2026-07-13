export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem", lineHeight: 1.55, fontFamily: "system-ui, sans-serif" }}>
      <h1>Informativa privacy — dati salute</h1>
      <p>
        RobertaFunctional legge allenamenti di corsa e camminata da Apple Health / Health Connect
        solo dopo consenso esplicito. I dati restano sul dispositivo e, se attivi il sync cloud,
        nel tuo account su Supabase. Non vendiamo dati salute.
      </p>
      <h2>Fonti</h2>
      <ul>
        <li>Apple Watch via Apple Salute</li>
        <li>Garmin via Garmin Connect → Apple Salute / Health Connect</li>
        <li>Huawei via Huawei Health → Health Connect o file GPX</li>
      </ul>
      <h2>Revoca</h2>
      <p>Puoi revocare i permessi dalle impostazioni di sistema o scollegare l&apos;integrazione nell&apos;app.</p>
    </main>
  );
}
