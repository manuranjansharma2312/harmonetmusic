import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/useBranding';
import { supabase } from '@/integrations/supabase/client';
import { countries, getStatesForCountry } from '@/data/locations';

const SocialIcon = ({ type }: { type: string }) => {
  const icons: Record<string, string> = {
    instagram: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/instagram.svg',
    facebook: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/facebook.svg',
    spotify: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/spotify.svg',
    youtube: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/youtube.svg',
  };
  return <img src={icons[type]} alt={type} className="h-4 w-4 sm:h-5 sm:w-5 invert opacity-50" />;
};

export default function Auth() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [userType, setUserType] = useState<'artist' | 'record_label'>('artist');
  const [artistName, setArtistName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappCode, setWhatsappCode] = useState('+91');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [spotify, setSpotify] = useState('');
  const [youtube, setYoutube] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);

  const { signIn, signUp } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && role) {
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  const selectedWhatsAppCountry = countries.find((item) => item.dialCode === whatsappCode);
  const availableStates = country ? getStatesForCountry(country) : [];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setSubmitting(false);
    if (error) toast.error(error.message);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!idFront || !idBack) {
      toast.error('Please upload both front and back of your ID proof');
      return;
    }
    setSubmitting(true);

    try {
      const { error: signUpError } = await signUp(email, password);
      if (signUpError) throw signUpError;

      const { error: signInError } = await signIn(email, password);
      if (signInError) throw signInError;

      const {
        data: { user: newUser },
      } = await supabase.auth.getUser();
      if (!newUser) throw new Error('User not found after signup');

      let idFrontUrl = null;
      let idBackUrl = null;

      if (idFront) {
        const path = `${newUser.id}/front-${Date.now()}-${idFront.name}`;
        const { error } = await supabase.storage.from('id-proofs').upload(path, idFront);
        if (error) throw error;
        const { data } = supabase.storage.from('id-proofs').getPublicUrl(path);
        idFrontUrl = data.publicUrl;
      }

      if (idBack) {
        const path = `${newUser.id}/back-${Date.now()}-${idBack.name}`;
        const { error } = await supabase.storage.from('id-proofs').upload(path, idBack);
        if (error) throw error;
        const { data } = supabase.storage.from('id-proofs').getPublicUrl(path);
        idBackUrl = data.publicUrl;
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: newUser.id,
        user_type: userType,
        artist_name: userType === 'artist' ? artistName : null,
        record_label_name: userType === 'record_label' ? labelName : null,
        legal_name: legalName,
        email,
        whatsapp_country_code: whatsappCode,
        whatsapp_number: whatsappNumber,
        instagram_link: instagram || null,
        facebook_link: facebook || null,
        spotify_link: spotify || null,
        youtube_link: youtube || null,
        country,
        state,
        address,
        id_proof_front_url: idFrontUrl,
        id_proof_back_url: idBackUrl,
      });

      if (profileError) throw profileError;

      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputBaseClass =
    'w-full rounded-lg bg-muted/50 border border-border py-2.5 sm:py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all';
  const inputClass = `${inputBaseClass} px-3 sm:px-4`;
  const inputWithLeftIconClass = `${inputBaseClass} pl-10 sm:pl-11 pr-3 sm:pr-4`;
  const inputWithSideActionClass = `${inputBaseClass} pl-10 sm:pl-11 pr-10 sm:pr-11`;
  const inputWithActionClass = `${inputBaseClass} px-3 sm:px-4 pr-10 sm:pr-11`;
  const compactSelectClass = `${inputBaseClass} w-[100px] sm:w-[120px] pl-8 sm:pl-10 pr-7 sm:pr-8 appearance-none`;

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden overflow-y-auto px-3 py-6 sm:px-4 sm:py-8">
      <BackgroundBlobs />
      <div className="glass-card-glow relative z-10 mx-auto my-auto w-full max-w-lg animate-scale-in p-4 sm:p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logoWhite} alt="Harmonet Music" className="h-12 sm:h-16 w-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            {isLogin ? 'Sign in to your account' : 'Create your artist account'}
          </p>
        </div>

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:h-5 sm:w-5" />
              <input
                type="email"
                placeholder="Email address"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className={inputWithLeftIconClass}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:h-5 sm:w-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className={inputWithSideActionClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">I am a *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType('artist')}
                  className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                    userType === 'artist'
                      ? 'btn-primary-gradient text-primary-foreground border-transparent'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                  }`}
                >
                  Artist
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('record_label')}
                  className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                    userType === 'record_label'
                      ? 'btn-primary-gradient text-primary-foreground border-transparent'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                  }`}
                >
                  Record Label
                </button>
              </div>
            </div>

            {userType === 'artist' ? (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Artist Name *</label>
                <input
                  className={inputClass}
                  placeholder="Your artist / stage name"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Record Label Name *</label>
                <input
                  className={inputClass}
                  placeholder="Your record label name"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-1">Legal Name *</label>
              <input
                className={inputClass}
                placeholder="Full legal name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">Email *</label>
              <input
                type="email"
                className={inputClass}
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">WhatsApp Number *</label>
              <div className="flex flex-col min-[420px]:flex-row gap-2">
                <div className="relative flex-shrink-0">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lg sm:text-xl pointer-events-none">
                    {selectedWhatsAppCountry?.flag || '🏳️'}
                  </div>
                  <select
                    value={whatsappCode}
                    onChange={(e) => setWhatsappCode(e.target.value)}
                     className={`${compactSelectClass} w-full min-[420px]:w-[100px] sm:w-[120px]`}
                  >
                    {countries.map((item) => (
                      <option key={item.code} value={item.dialCode}>
                        {item.flag} {item.dialCode}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="tel"
                  className={inputClass}
                  placeholder="Phone number"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-muted-foreground">Social Links</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SocialIcon type="instagram" />
                </div>
                <input
                  className={inputWithLeftIconClass}
                  placeholder="Instagram profile URL"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SocialIcon type="facebook" />
                </div>
                <input
                  className={inputWithLeftIconClass}
                  placeholder="Facebook profile URL"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                />
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SocialIcon type="spotify" />
                </div>
                <input
                  className={inputWithLeftIconClass}
                  placeholder="Spotify artist URL"
                  value={spotify}
                  onChange={(e) => setSpotify(e.target.value)}
                />
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SocialIcon type="youtube" />
                </div>
                <input
                  className={inputWithLeftIconClass}
                  placeholder="YouTube channel URL"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Country *</label>
                <select
                  className={inputClass}
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setState('');
                  }}
                  required
                >
                  <option value="">Select Country</option>
                  {countries.map((item) => (
                    <option key={item.code} value={item.name}>
                      {item.flag} {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">State *</label>
                <select
                  className={inputClass}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  disabled={!country || availableStates.length === 0}
                >
                  <option value="">
                    {!country
                      ? 'Select country first'
                      : availableStates.length > 0
                        ? 'Select State'
                        : 'No states available'}
                  </option>
                  {availableStates.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">Address *</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                placeholder="Full address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={inputWithActionClass}
                    placeholder="Min 6 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={inputWithActionClass}
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">ID Proof Upload *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdFront(e.target.files?.[0] || null)}
                    className="hidden"
                    id="id-front"
                  />
                  <label htmlFor="id-front" className={`${inputClass} cursor-pointer flex items-center justify-center gap-2 text-center break-all`}>
                    📄 {idFront ? `${idFront.name.slice(0, 15)}...` : 'Front Side'}
                  </label>
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdBack(e.target.files?.[0] || null)}
                    className="hidden"
                    id="id-back"
                  />
                  <label htmlFor="id-back" className={`${inputClass} cursor-pointer flex items-center justify-center gap-2 text-center break-all`}>
                    📄 {idBack ? `${idBack.name.slice(0, 15)}...` : 'Back Side'}
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Account
            </button>
          </form>
        )}

        <p className="text-center mt-6 text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
            {isLogin ? 'Sign Up as Artist' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
