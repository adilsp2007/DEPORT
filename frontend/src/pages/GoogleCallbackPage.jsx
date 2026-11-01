import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import { AlertCircle } from 'lucide-react';

export const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const { loginWithGoogle } = useAuth();
  const { showToast } = useShop();
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const handleGoogleAuth = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const code = searchParams.get('code');
      const token = searchParams.get('token') || searchParams.get('credential') || hashParams.get('id_token') || hashParams.get('credential') || hashParams.get('access_token');
      const error = searchParams.get('error') || hashParams.get('error');

      if (error) {
        if (isMounted) {
          setErrorMessage('Google authentication was cancelled or declined.');
          setLoading(false);
        }
        return;
      }

      try {
        if (token || code) {
          const redirectUri = `${window.location.origin}/auth/google/callback`;
          const resp = await loginWithGoogle({
            code: code || undefined,
            token: token || code,
            redirect_uri: redirectUri
          });

          if (resp?.requires_two_step) {
            showToast('Two-step verification code sent to your email.');
            navigate('/login', {
              state: {
                twoStepEmail: resp.email,
                requiresTwoStep: true,
                otpCode: resp.otp_code || ''
              }
            });
            return;
          }

          showToast('Signed in with Google successfully!');
          navigate('/');
        } else {
          if (isMounted) {
            setErrorMessage('No authentication credential or authorization code received from Google.');
            setLoading(false);
          }
          return;
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(
            err.response?.data?.detail || 'Unable to sign in with Google. Please check your credentials and try again.'
          );
          setLoading(false);
        }
      }
    };

    handleGoogleAuth();

    return () => {
      isMounted = false;
    };
  }, [searchParams, loginWithGoogle, navigate, showToast]);

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 bg-[#0B0F0D]">
      <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-8 sm:p-12 text-center shadow-xl">
        <span className="font-serif text-3xl tracking-widest text-[#F3F4F6] block mb-1">
          DEPORT
        </span>
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#10B981] font-semibold block mb-8">
          Carry Your Style
        </span>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <LoadingSpinner size="lg" />
            <h3 className="font-serif text-xl font-normal text-[#F3F4F6] mt-2">
              Completing your Google sign-in...
            </h3>
            <p className="text-xs text-gray-400">Verifying identity with Google Atelier</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-500 flex items-center justify-center mb-2">
              <AlertCircle size={24} />
            </div>
            <h3 className="font-serif text-xl font-semibold text-[#F3F4F6]">
              Authentication Failed
            </h3>
            <p className="text-xs text-rose-400 max-w-xs leading-relaxed mb-6">
              {errorMessage}
            </p>
            <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
