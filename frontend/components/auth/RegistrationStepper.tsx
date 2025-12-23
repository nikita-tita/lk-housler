'use client';

interface Step {
  id: string;
  title: string;
}

interface RegistrationStepperProps {
  steps: Step[];
  currentStep: number;
}

export function RegistrationStepper({ steps, currentStep }: RegistrationStepperProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index < currentStep
                    ? 'bg-[var(--gray-900)] text-white'
                    : index === currentStep
                    ? 'bg-[var(--gray-900)] text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-light)]'
                }`}
              >
                {index < currentStep ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-2 text-xs text-center max-w-[80px] ${
                  index <= currentStep ? 'text-[var(--color-text)]' : 'text-[var(--color-text-light)]'
                }`}
              >
                {step.title}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  index < currentStep
                    ? 'bg-[var(--gray-900)]'
                    : 'bg-[var(--color-border)]'
                }`}
                style={{ minWidth: '40px' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
