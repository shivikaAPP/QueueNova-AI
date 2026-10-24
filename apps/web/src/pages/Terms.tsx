import React from 'react';

export const Terms: React.FC = () => {
  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12">
      <article className="max-w-[65ch]">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Terms and conditions
        </h1>
        <p className="text-sm text-ink-muted mb-8">Last updated: 24 October 2026</p>

        <section className="space-y-6 text-base leading-relaxed text-ink">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. About QueueNova</h2>
            <p>
              QueueNova is a prototype queue management application operated by QueueNova Project. It demonstrates digital tokens, wait estimates and counter recommendations using sample data.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">2. Prototype status</h2>
            <p>
              This version is a demonstration. Organisations, counters and customers shown are sample records unless stated otherwise. Do not rely on it to manage a real service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">3. Wait estimates</h2>
            <p>
              Estimated waiting times and suggested return windows are calculated from the number of people ahead, recent service durations and counter availability. They are estimates. Actual waiting times can be shorter or longer, and the service provider's decision on who is served next is final.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">4. Priority and appointments</h2>
            <p>
              Priority categories and appointment windows follow the rules shown on the join page. Priority status is checked by staff before it applies. Providing false information to obtain priority may lead to your token being moved to the standard queue.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">5. Your responsibilities</h2>
            <p>
              Give accurate information. Do not attempt to disrupt the service, access the admin area without permission, or interfere with other people's tokens.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">6. Demo admin area</h2>
            <p>
              The admin area in this prototype is a demonstration and is not protected by real authentication. Do not enter real personal data there.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">7. Availability</h2>
            <p>
              The service is provided as is. We do not promise it will be uninterrupted or error free.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">8. Limitation of liability</h2>
            <p>
              To the extent allowed by law, QueueNova Project is not liable for losses caused by relying on estimates or by the unavailability of the prototype.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">9. Changes</h2>
            <p>
              We may update these terms. The date at the top shows the latest version.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">10. Governing law</h2>
            <p>
              These terms are governed by the laws of India.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">11. Contact</h2>
            <p>
              support@queuenova.app
            </p>
          </div>
        </section>
      </article>
    </div>
  );
};

export default Terms;
