export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem", lineHeight: 1.55, fontFamily: "system-ui, sans-serif" }}>
      <h1>Informativa privacy — dati salute</h1>
      <p>
        RobertaFunctional legge da Apple Health / Health Connect, dopo consenso esplicito,
        allenamenti (corsa, camminata, forza) e segnali salute utili al piano: frequenza cardiaca,
        FC a riposo, HRV, frequenza respiratoria, saturazione, passi e sonno. I dati importati
        vengono salvati nel tuo account Supabase per renderli disponibili anche sul web e sugli altri dispositivi.
        Non vendiamo dati salute e non ricostruiamo serie o ripetizioni che la fonte non fornisce.
      </p>
      <h2>Fonti</h2>
      <ul>
        <li>Apple Watch via Apple Salute</li>
        <li>Garmin via Garmin Connect → Apple Salute / Health Connect</li>
        <li>Huawei via Huawei Health → Health Connect o file GPX</li>
      </ul>
      <h2>Revoca</h2>
      <p>Puoi revocare i permessi dalle impostazioni di sistema o scollegare l&apos;integrazione nell&apos;app.</p>
      <h2>Visibilità</h2>
      <p>Il trainer assegnato può vedere le attività utili a seguire il piano. Gli amministratori vedono soprattutto lo stato della sincronizzazione e non i dettagli sanitari, salvo necessità operative autorizzate.</p>
    </main>
  );
}
