import { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { countries, getStatesForCountry } from '@/data/locations';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [userType, setUserType] = useState<'artist' | 'record_label'>('artist');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [artistName, setArtistName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [whatsappCode, setWhatsappCode] = useState('+91');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [cutPercent, setCutPercent] = useState('0');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [spotify, setSpotify] = useState('');
  const [youtube, setYoutube] = useState('');

  const availableStates = country ? getStatesForCountry(country) : [];

  const resetForm = () => {
    setUserType('artist');
    setEmail('');
    setPassword('');
    setArtistName('');
    setLabelName('');
    setLegalName('');
    setWhatsappCode('+91');
    setWhatsappNumber('');
    setCountry('');
    setState('');
    setAddress('');
    setCutPercent('0');
    setInstagram('');
    setFacebook('');
    setSpotify('');
    setYoutube('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!email || !password || !legalName || !whatsappNumber || !country || !state || !address) {
      toast.error('Please fill all required fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (userType === 'artist' && !artistName) {
      toast.error('Artist name is required');
      return;
    }
    if (userType === 'record_label' && !labelName) {
      toast.error('Record label name is required');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          user_type: userType,
          artist_name: userType === 'artist' ? artistName : null,
          record_label_name: userType === 'record_label' ? labelName : null,
          legal_name: legalName,
          whatsapp_country_code: whatsappCode,
          whatsapp_number: whatsappNumber,
          country,
          state,
          address,
          hidden_cut_percent: parseFloat(cutPercent) || 0,
          instagram_link: instagram || null,
          facebook_link: facebook || null,
          spotify_link: spotify || null,
          youtube_link: youtube || null,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Failed to create user');
        return;
      }

      toast.success('User created successfully');
      resetForm();
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputClass = "w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Create New User
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* User Type */}
          <div>
            <label className={labelClass}>User Type *</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setUserType('artist')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${userType === 'artist' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-foreground hover:bg-muted'}`}>
                Artist
              </button>
              <button type="button" onClick={() => setUserType('record_label')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${userType === 'record_label' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-foreground hover:bg-muted'}`}>
                Record Label
              </button>
            </div>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userType === 'artist' ? (
              <div>
                <label className={labelClass}>Artist Name *</label>
                <input className={inputClass} value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Artist / Band name" />
              </div>
            ) : (
              <div>
                <label className={labelClass}>Record Label Name *</label>
                <input className={inputClass} value={labelName} onChange={e => setLabelName(e.target.value)} placeholder="Record label name" />
              </div>
            )}
            <div>
              <label className={labelClass}>Legal Name *</label>
              <input className={inputClass} value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Full legal name" />
            </div>
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <label className={labelClass}>Password *</label>
              <input type="password" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>WhatsApp Code</label>
              <select className={inputClass} value={whatsappCode} onChange={e => setWhatsappCode(e.target.value)}>
                {countries.map(c => (
                  <option key={c.dialCode + c.name} value={c.dialCode}>{c.dialCode} ({c.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>WhatsApp Number *</label>
              <input className={inputClass} value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="Phone number" />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Country *</label>
              <select className={inputClass} value={country} onChange={e => { setCountry(e.target.value); setState(''); }}>
                <option value="">Select</option>
                {countries.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>State *</label>
              {availableStates.length > 0 ? (
                <select className={inputClass} value={state} onChange={e => setState(e.target.value)}>
                  <option value="">Select</option>
                  {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input className={inputClass} value={state} onChange={e => setState(e.target.value)} placeholder="State / Region" />
              )}
            </div>
            <div>
              <label className={labelClass}>Address *</label>
              <input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address" />
            </div>
          </div>

          {/* Revenue Cut */}
          <div>
            <label className={labelClass}>Hidden Cut % (Revenue deduction)</label>
            <input
              type="text"
              inputMode="decimal"
              className={`${inputClass} w-full sm:w-40`}
              value={cutPercent}
              onChange={e => setCutPercent(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
            />
          </div>

          {/* Social Links - collapsible */}
          <details className="group">
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Social Links (optional)
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className={labelClass}>Instagram</label>
                <input className={inputClass} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/..." />
              </div>
              <div>
                <label className={labelClass}>Facebook</label>
                <input className={inputClass} value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/..." />
              </div>
              <div>
                <label className={labelClass}>Spotify</label>
                <input className={inputClass} value={spotify} onChange={e => setSpotify(e.target.value)} placeholder="https://open.spotify.com/..." />
              </div>
              <div>
                <label className={labelClass}>YouTube</label>
                <input className={inputClass} value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="https://youtube.com/..." />
              </div>
            </div>
          </details>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 disabled:opacity-50 transition-all">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
