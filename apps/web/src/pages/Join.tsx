import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle } from 'lucide-react';
import { useQueueStore } from '../store/queueStore.js';
import { isSlotValidNow, estimateForNewArrival, formatTime } from '@queuenova/queue-engine';

export const Join: React.FC = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const { appState, selectedOrgId, setSelectedOrgId, dispatch } = useQueueStore();

  const org = appState.orgs[selectedOrgId] || Object.values(appState.orgs)[0];

  const [serviceId, setServiceId] = useState<string>('');
  const [name, setName] = useState('');
  const [entryType, setEntryType] = useState<'walkin' | 'appointment'>('walkin');
  const [slotId, setSlotId] = useState<string>('');
  const [requestPriority, setRequestPriority] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (org && org.services.length > 0 && !serviceId) {
      setServiceId(org.services[0].id);
    }
  }, [org, serviceId]);

  const now = mounted ? Date.now() : 0;
  const currentSlots = org?.slots.filter((s) => s.serviceId === serviceId) || [];
  const selectedSlot = currentSlots.find((s) => s.id === slotId);
  const isSelectedSlotValid = selectedSlot && org ? isSlotValidNow(selectedSlot, org.settings, now) : true;

  const previewEstimate = mounted && org && serviceId ? estimateForNewArrival(org, serviceId, now) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 60) {
      setErrorMessage('Name must be between 1 and 60 characters.');
      return;
    }

    if (!serviceId) {
      setErrorMessage('Please select a service.');
      return;
    }

    if (entryType === 'appointment') {
      if (!slotId) {
        setErrorMessage('Please choose an appointment slot.');
        return;
      }
      if (!isSelectedSlotValid) {
        setErrorMessage('This slot is outside its window. You can join as a walk-in instead.');
        return;
      }
    }

    const res = dispatch({
      type: 'join',
      orgId: org.id,
      name: trimmedName,
      serviceId,
      slotId: entryType === 'appointment' ? slotId : undefined,
      requestPriority,
    });

    if (res.ok && res.token) {
      navigate(`/pass?t=${res.token}`);
    } else if (!res.ok) {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">
          Get your queue token
        </h1>
        <p className="text-base text-ink-muted mb-6">
          Choose a service, enter your name, and receive a digital token with an estimated wait and a suggested time to come back.
        </p>

        {/* Published ordering rules */}
        <div className="border border-border rounded-[8px] bg-surface p-4 sm:p-5 mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink mb-2">
            Published ordering rules
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Queue priority applies first (after staff check), followed by valid appointments, then walk-ins. Within each group, service order is first come, first served.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-box bg-surface space-y-6">
          {errorMessage && (
            <div
              className="p-4 rounded-[6px] bg-critical-bg border border-critical/30 text-critical text-sm flex items-start gap-3"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p>{errorMessage}</p>
                {errorMessage.includes('outside its window') && (
                  <button
                    type="button"
                    onClick={() => {
                      setEntryType('walkin');
                      setErrorMessage(null);
                    }}
                    className="mt-2 text-xs font-semibold underline hover:text-ink cursor-pointer"
                  >
                    Switch to walk-in
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Organisation */}
          <div>
            <label htmlFor="join-org" className="block text-sm font-semibold text-ink mb-1">
              Organisation
            </label>
            <select
              id="join-org"
              value={org ? org.id : ''}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setServiceId('');
                setSlotId('');
              }}
              className="input-field"
            >
              {Object.values(appState.orgs).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label htmlFor="join-service" className="block text-sm font-semibold text-ink mb-1">
              Service
            </label>
            <select
              id="join-service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSlotId('');
              }}
              className="input-field"
              required
            >
              {org?.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.defaultMinutes} min standard)
                </option>
              ))}
            </select>

            {/* Estimated wait preview before submit */}
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                Estimated wait for new arrival:{' '}
                {!mounted
                  ? 'Calculating...'
                  : previewEstimate !== null
                  ? `${previewEstimate} minutes`
                  : 'Waiting for an available counter'}
              </span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="join-name" className="block text-sm font-semibold text-ink mb-1">
              Your name or nickname
            </label>
            <input
              id="join-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={60}
              required
              className="input-field"
              aria-describedby="name-desc"
            />
            <p id="name-desc" className="text-xs text-ink-muted mt-1">
              Between 1 and 60 characters. Do not enter phone, email or ID numbers.
            </p>
          </div>

          {/* Walk-in or Appointment */}
          <fieldset className="space-y-2">
            <legend className="block text-sm font-semibold text-ink mb-1">
              Entry method
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <label
                className={`flex items-center gap-3 p-3 rounded-[6px] border cursor-pointer ${
                  entryType === 'walkin'
                    ? 'border-primary bg-bg text-ink'
                    : 'border-border bg-surface text-ink-muted'
                }`}
              >
                <input
                  type="radio"
                  name="entryType"
                  value="walkin"
                  checked={entryType === 'walkin'}
                  onChange={() => setEntryType('walkin')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium">Walk-in</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-[6px] border cursor-pointer ${
                  entryType === 'appointment'
                    ? 'border-primary bg-bg text-ink'
                    : 'border-border bg-surface text-ink-muted'
                }`}
              >
                <input
                  type="radio"
                  name="entryType"
                  value="appointment"
                  checked={entryType === 'appointment'}
                  onChange={() => setEntryType('appointment')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium">Appointment</span>
              </label>
            </div>
          </fieldset>

          {/* Appointment Slot Picker */}
          {entryType === 'appointment' && (
            <div>
              <label htmlFor="join-slot" className="block text-sm font-semibold text-ink mb-1">
                Select appointment slot
              </label>
              {currentSlots.length === 0 ? (
                <p className="text-sm text-ink-muted">No appointment slots scheduled for this service.</p>
              ) : (
                <select
                  id="join-slot"
                  value={slotId}
                  onChange={(e) => setSlotId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">-- Choose a slot --</option>
                  {currentSlots.map((s) => {
                    const valid = org ? isSlotValidNow(s, org.settings, now) : false;
                    const timeStr = formatTime(s.startsAt);
                    return (
                      <option key={s.id} value={s.id}>
                        {timeStr} {valid ? '(Valid now)' : '(Outside window)'}
                      </option>
                    );
                  })}
                </select>
              )}
              {slotId && !isSelectedSlotValid && (
                <p className="text-xs text-critical mt-1">
                  This slot is outside its window. You can join as a walk-in instead.
                </p>
              )}
            </div>
          )}

          {/* Priority Request */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requestPriority}
                onChange={(e) => setRequestPriority(e.target.checked)}
                className="mt-1 w-4 h-4 text-primary border-border rounded-[4px]"
              />
              <span className="text-sm text-ink leading-relaxed">
                I am requesting priority under the rules above. Staff will check this before it applies.
              </span>
            </label>
          </div>

          <div className="pt-4">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Get my token
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Join;
