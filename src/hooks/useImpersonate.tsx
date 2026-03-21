import { createContext, useContext, useState, ReactNode } from 'react';

interface ImpersonateContextType {
  impersonatedUserId: string | null;
  impersonatedEmail: string | null;
  startImpersonating: (userId: string, email: string) => void;
  stopImpersonating: () => void;
  isImpersonating: boolean;
}

const ImpersonateContext = createContext<ImpersonateContextType>({
  impersonatedUserId: null,
  impersonatedEmail: null,
  startImpersonating: () => {},
  stopImpersonating: () => {},
  isImpersonating: false,
});

export function ImpersonateProvider({ children }: { children: ReactNode }) {
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(null);

  const startImpersonating = (userId: string, email: string) => {
    setImpersonatedUserId(userId);
    setImpersonatedEmail(email);
  };

  const stopImpersonating = () => {
    setImpersonatedUserId(null);
    setImpersonatedEmail(null);
  };

  return (
    <ImpersonateContext.Provider
      value={{
        impersonatedUserId,
        impersonatedEmail,
        startImpersonating,
        stopImpersonating,
        isImpersonating: !!impersonatedUserId,
      }}
    >
      {children}
    </ImpersonateContext.Provider>
  );
}

export function useImpersonate() {
  return useContext(ImpersonateContext);
}
