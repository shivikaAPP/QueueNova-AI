import React from 'react';

export const Privacy: React.FC = () => {
  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12">
      <article className="max-w-[65ch]">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Privacy policy
        </h1>
        <p className="text-sm text-ink-muted mb-8">Last updated: 24 October 2026</p>

        <section className="space-y-6 text-base leading-relaxed text-ink">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. Who we are</h2>
            <p>
              QueueNova is operated by QueueNova Project. Contact: support@queuenova.app.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">2. What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name or nickname you enter when joining a queue.</li>
              <li>The service you selected, whether you chose walk-in or appointment, and your appointment slot.</li>
              <li>Whether you requested priority and the category you selected.</li>
              <li>Your token number, queue status and notification history.</li>
            </ul>
            <p className="mt-2">
              We do not ask for your phone number, email address, government ID or payment details. Do not enter them in any field.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">3. Where it is stored</h2>
            <p>
              Phase 1 (browser-only prototype): this data is stored in your own browser using localStorage and is not sent to a server.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">4. Why we use it</h2>
            <p>
              To issue your token, calculate your wait, show your position, and let staff manage the queue.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">5. Cookies and tracking</h2>
            <p>
              QueueNova does not use advertising cookies or third-party trackers.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">6. How long we keep it</h2>
            <p>
              Browser-only prototype: until you clear your browser data or staff reset the demo data.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">7. Your choices</h2>
            <p>
              You can delete your data by clearing site data in your browser.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">8. Sharing</h2>
            <p>
              We do not sell your data.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">9. Children</h2>
            <p>
              QueueNova is not directed at children.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">10. Changes</h2>
            <p>
              We will update the date above when this policy changes.
            </p>
          </div>
        </section>
      </article>
    </div>
  );
};

export default Privacy;
