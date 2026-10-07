import { memo, useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, Gem, RefreshCw, AlertCircle, Trophy, BadgePercent } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { gameApi, paymentsApi, type GameSessionState, type ApiError } from '@/services/api';
import { sendSolanaUsdc, sendUsdcOnEvm, waitForUsdcTx } from '@/services/usdc';
import { HAS_BACKEND } from '@/lib/backend';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { getCardMultiplierPrice, MAX_CARD_MULTIPLIER, MIN_CARD_MULTIPLIER } from '@/types/game';
import treasure1Image from '@/assets/treasures/treasure-1.jpeg';
import treasure2Image from '@/assets/treasures/treasure-2.jpeg';
import treasure3Image from '@/assets/treasures/treasure-3.jpeg';
import treasure4Image from '@/assets/treasures/treasure-4.jpeg';
import treasure5Image from '@/assets/treasures/treasure-5.jpeg';
import treasure6Image from '@/assets/treasures/treasure-6.jpeg';

const CARDS_PER_ROUND = 8;
const CARD_PRICE_USDC = 0.1;
const OPEN_ALL_PRICE_USDC = 0.8;
const REVEAL_MAX_ATTEMPTS = 18;
const REVEAL_RETRY_MS = 4000;
const OPEN_ALL_RESULT_DISPLAY_MS = 3200;
const AUTH_ERRORS = new Set(["unauthenticated", "invalid_token", "token_revoked"]);
const DARK_GAME_CARD_CLASS = "border border-border bg-card/95 shadow-card";
const MULTIPLIER_OPTIONS = Array.from(
  { length: MAX_CARD_MULTIPLIER - MIN_CARD_MULTIPLIER + 1 },
  (_, i) => MIN_CARD_MULTIPLIER + i,
);

function asFriendlyError(msg: string) {
  return AUTH_ERRORS.has(msg) ? "Session expired. Please sign in again." : msg;
}

type CardState = 'idle' | 'processing' | 'revealed';

type TreasureItem = {
  id: string;
  name: string;
  image: string;
};

const TREASURE_IMAGE_OVERRIDES: Record<string, string> = {
  pearl_of_tides: treasure1Image,
  abyssal_key: treasure2Image,
  coral_crown: treasure3Image,
  sunken_compass: treasure4Image,
  storm_anchor: treasure5Image,
  atlas_fragment: treasure6Image,
};

function withTreasureImage(treasure?: TreasureItem | null): TreasureItem | null {
  if (!treasure) return null;
  return {
    ...treasure,
    image: TREASURE_IMAGE_OVERRIDES[treasure.id] ?? treasure.image,
  };
}

interface UICard {
  index: number;
  state: CardState;
  result: 'treasure' | 'empty' | null;
  bdPointsEarned: number | null;
}

function buildCards(session: GameSessionState | null): UICard[] {
  const cardsPerRound = session?.cardsPerRound ?? CARDS_PER_ROUND;
  const revealedByIndex = new Map(
    (session?.revealedCards ?? []).map((card) => [card.cardIndex, card]),
  );
  return Array.from({ length: cardsPerRound }, (_, i) => {
    const revealed = revealedByIndex.get(i);
    return {
      index: i,
      state: revealed ? 'revealed' : 'idle',
      result: revealed ? revealed.result : null,
      bdPointsEarned: revealed ? revealed.bdPointsEarned : null,
    };
  });
}

function buildCardsFromRevealed(
  revealedCards: GameSessionState['revealedCards'],
  cardsPerRound: number,
): UICard[] {
  const revealedByIndex = new Map(
    (revealedCards ?? []).map((card) => [card.cardIndex, card]),
  );
  return Array.from({ length: cardsPerRound }, (_, i) => {
    const revealed = revealedByIndex.get(i);
    return {
      index: i,
      state: revealed ? 'revealed' : 'idle',
      result: revealed ? revealed.result : null,
      bdPointsEarned: revealed ? revealed.bdPointsEarned : null,
    };
  });
}

export default function GamingPage() {
  const { isConnected, chainId } = useAccount();
  const {
    authChainType,
    baseUser,
    solanaAddress,
    connectSolanaWallet,
  } = useAuth();
  const { user, refreshUser } = useGame();
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [cards, setCards] = useState<UICard[]>(() => buildCards(null));
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [isOpenAllProcessing, setIsOpenAllProcessing] = useState(false);
  const [isMultiplierProcessing, setIsMultiplierProcessing] = useState(false);
  const [selectedMultiplier, setSelectedMultiplier] = useState(MIN_CARD_MULTIPLIER);
  const [showingOpenAllResults, setShowingOpenAllResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastReveal, setLastReveal] = useState<{ result: 'treasure' | 'empty'; bd: number; treasure?: TreasureItem | null; completedSeason?: boolean } | null>(null);

  async function submitGamePayment(amount: number, gameSession: GameSessionState) {
    const network = gameSession.paymentNetworks.find((candidate) =>
      candidate.chainType === authChainType &&
      (candidate.chainType === "solana" || candidate.chainId === chainId),
    );
    if (!network) throw new Error("Payment network is not supported for this signed-in wallet.");
    if (network.chainType === "solana") {
      const { wallet, account } = await connectSolanaWallet();
      if (account.address !== solanaAddress || account.address !== baseUser?.wallet) {
        throw new Error("Reconnect the same Phantom Solana wallet you used to sign in.");
      }
      const signature = await sendSolanaUsdc(
        wallet,
        account,
        network.recipient,
        network.usdcContract,
        BigInt(Math.round(amount * 1_000_000)).toString(),
      );
      return { signature, chainType: "solana" as const, chainId: network.chainId };
    }
    if (!isConnected) throw new Error("Connect your signed-in EVM wallet first.");
    const signature = await sendUsdcOnEvm(
      network.recipient as `0x${string}`,
      amount,
      network.usdcContract as `0x${string}`,
      Number(network.chainId),
    );
    await waitForUsdcTx(signature, Number(network.chainId));
    return { signature, chainType: "evm" as const, chainId: network.chainId };
  }

  const refresh = useCallback(async () => {
    if (!HAS_BACKEND) {
      setLoading(false);
      setError('Backend not configured. Set VITE_API_URL to enable the game.');
      return;
    }
    try {
      const { session: s } = await gameApi.start();
      setSession(s);
      setCards(buildCards(s));
      setError(null);
    } catch (e) {
      const msg = (e as Error).message || "Failed to load game";
      setError(asFriendlyError(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!HAS_BACKEND) return;
    const interval = window.setInterval(async () => {
      try {
        const { session: s } = await gameApi.state();
        setSession(s);
        setCards(buildCards(s));
      } catch {
        // keep current UI state
      }
    }, 12000);
    return () => window.clearInterval(interval);
  }, []);

  const requiredTreasures = session?.requiredTreasures ?? 6;
  const seasonTreasures = (session?.seasonTreasures ?? [])
    .map((treasure) => withTreasureImage(treasure))
    .filter((treasure): treasure is TreasureItem => Boolean(treasure));
  const treasureBank = (session?.treasureBank ?? [])
    .map((treasure) => withTreasureImage(treasure))
    .filter((treasure): treasure is TreasureItem => Boolean(treasure));
  const cardsPerRound = session?.cardsPerRound ?? CARDS_PER_ROUND;
  const cardPriceUsdc = session?.cardPriceUsdc ?? CARD_PRICE_USDC;
  const openAllPriceUsdc = session?.openAllPriceUsdc ?? OPEN_ALL_PRICE_USDC;
  const currentMultiplier = Math.max(1, Number(session?.cardMultiplier || user.cardMultiplier || 1));
  const hasMultiplier = currentMultiplier >= MIN_CARD_MULTIPLIER;
  const nextMultiplier = Math.min(MAX_CARD_MULTIPLIER, Math.max(MIN_CARD_MULTIPLIER, currentMultiplier + 1));
  const canUpgradeMultiplier = selectedMultiplier > currentMultiplier && currentMultiplier < MAX_CARD_MULTIPLIER;
  const completionPct = Math.min(100, Math.round((seasonTreasures.length / requiredTreasures) * 100));

  const treasureSlots = useMemo(
    () => Array.from({ length: requiredTreasures }, (_, i) => seasonTreasures[i] || null),
    [requiredTreasures, seasonTreasures],
  );

  useEffect(() => {
    if (selectedMultiplier <= currentMultiplier && currentMultiplier < MAX_CARD_MULTIPLIER) {
      setSelectedMultiplier(nextMultiplier);
    }
  }, [currentMultiplier, nextMultiplier, selectedMultiplier]);

  async function handleCardClick(index: number) {
    if (!HAS_BACKEND) {
      toast.error('Backend not configured');
      return;
    }
    if (processingIndex !== null || isOpenAllProcessing || showingOpenAllResults) return;
    if (cards[index].state !== 'idle') return;
    if (authChainType === "none") {
      toast.error('Sign in with a supported wallet first');
      return;
    }

    setProcessingIndex(index);
    setLastReveal(null);
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, state: 'processing' } : c)));

    try {
      const payment = await submitGamePayment(cardPriceUsdc, session!);
      const { signature } = payment;
      toast.message('Payment submitted', { description: `${signature.slice(0, 10)}...` });

      let res: Awaited<ReturnType<typeof gameApi.reveal>> | null = null;
      let lastErr: ApiError | null = null;
      for (let attempt = 1; attempt <= REVEAL_MAX_ATTEMPTS; attempt += 1) {
        try {
          res = await gameApi.reveal(index, signature, payment.chainId, payment.chainType);
          break;
        } catch (e) {
          const err = e as ApiError;
          lastErr = err;
          const code = String(err.message || '');
          const retryable =
            code === 'confirmations_pending' ||
            code === 'verification_in_progress' ||
            code === 'tx_not_found_yet';
          if (!retryable || attempt === REVEAL_MAX_ATTEMPTS) break;
          toast.message(`Confirming reveal payment on-chain (${attempt}/${REVEAL_MAX_ATTEMPTS})...`);
          await new Promise((resolve) => setTimeout(resolve, REVEAL_RETRY_MS));
        }
      }
      if (!res) throw lastErr || new Error('Reveal failed');

      setSession(res.session);
      setCards(buildCards(res.session));
      const completedSeason =
        Boolean(res.guaranteedCompletion || res.session.seasonEligible) ||
        res.session.seasonTreasures.length >= res.session.requiredTreasures;
      setLastReveal({
        result: completedSeason ? 'treasure' : res.result,
        bd: res.bdPointsEarned,
        treasure: withTreasureImage(res.foundTreasure || res.revealedCard.treasure || null),
        completedSeason,
      });

      if (completedSeason) {
        toast.success('6/6 treasures unlocked');
      } else if (res.result === 'treasure') {
        const treasureName = res.foundTreasure?.name || res.revealedCard.treasure?.name || 'Treasure';
        toast.success(`${treasureName} added to Treasure Bank`);
      } else {
        toast(`Empty card · +${res.bdPointsEarned} BD`);
      }
    } catch (e) {
      const msg = asFriendlyError((e as Error).message || "Reveal failed");
      setCards((prev) => prev.map((c, i) => (i === index && c.state === 'processing' ? { ...c, state: 'idle' } : c)));
      if (/user rejected|denied|user_denied/i.test(msg)) toast.error('Payment cancelled');
      else if (/tx_already_used|card_already_revealed/i.test(msg)) {
        toast.error('That card or transaction was already used');
        refresh();
      } else if (/amount_too_low/i.test(msg)) toast.error('Payment amount was too low');
      else if (/sender_mismatch/i.test(msg)) toast.error('Payment must come from your connected wallet');
      else toast.error(msg);
    } finally {
      setProcessingIndex(null);
    }
  }

  async function handleOpenAllCards() {
    if (!HAS_BACKEND) {
      toast.error('Backend not configured');
      return;
    }
    if (!session) return;
    if (processingIndex !== null || isOpenAllProcessing || showingOpenAllResults) return;
    if (session.revealedCards.length > 0) {
      toast.error('Open All works only on a fresh card set');
      return;
    }
    if (authChainType === "none") {
      toast.error('Sign in with a supported wallet first');
      return;
    }

    setIsOpenAllProcessing(true);
    setLastReveal(null);
    setCards((prev) => prev.map((c) => (c.state === 'idle' ? { ...c, state: 'processing' } : c)));

    try {
      const payment = await submitGamePayment(openAllPriceUsdc, session);
      const { signature } = payment;
      toast.message('Open-all payment submitted', { description: `${signature.slice(0, 10)}...` });

      let res: Awaited<ReturnType<typeof gameApi.openAll>> | null = null;
      let lastErr: ApiError | null = null;
      for (let attempt = 1; attempt <= REVEAL_MAX_ATTEMPTS; attempt += 1) {
        try {
          res = await gameApi.openAll(signature, payment.chainId, payment.chainType);
          break;
        } catch (e) {
          const err = e as ApiError;
          lastErr = err;
          const code = String(err.message || '');
          const retryable =
            code === 'confirmations_pending' ||
            code === 'verification_in_progress' ||
            code === 'tx_not_found_yet';
          if (!retryable || attempt === REVEAL_MAX_ATTEMPTS) break;
          toast.message(`Confirming open-all payment on-chain (${attempt}/${REVEAL_MAX_ATTEMPTS})...`);
          await new Promise((resolve) => setTimeout(resolve, REVEAL_RETRY_MS));
        }
      }
      if (!res) throw lastErr || new Error('Open all failed');

      const revealViewSession: GameSessionState = { ...res.session, revealedCards: res.cards };
      setSession(revealViewSession);
      setCards(buildCardsFromRevealed(res.cards, cardsPerRound));
      setShowingOpenAllResults(true);

      const bdTotal = res.cards.reduce((sum, card) => sum + Number(card.bdPointsEarned || 0), 0);
      const completedSeason =
        Boolean(res.guaranteedCompletion || res.session.seasonEligible) ||
        res.session.seasonTreasures.length >= res.session.requiredTreasures;
      setLastReveal({
        result: completedSeason || res.foundTreasure ? 'treasure' : 'empty',
        bd: bdTotal,
        treasure: withTreasureImage(res.foundTreasure || null),
        completedSeason,
      });

      if (completedSeason) {
        toast.success('6/6 treasures unlocked');
      } else if (res.foundTreasure) {
        toast.success(`${res.foundTreasure.name} found. All cards opened.`);
      } else {
        toast.success(`All cards opened · +${bdTotal} BD`);
      }

      window.setTimeout(() => {
        setSession(res.session);
        setCards(buildCards(res.session));
        setShowingOpenAllResults(false);
      }, OPEN_ALL_RESULT_DISPLAY_MS);
    } catch (e) {
      const msg = asFriendlyError((e as Error).message || "Open all failed");
      setCards(buildCards(session));
      if (/user rejected|denied|user_denied/i.test(msg)) toast.error('Payment cancelled');
      else if (/tx_already_used|open_all_requires_fresh_round/i.test(msg)) {
        toast.error('Open All requires a fresh card set and a new transaction');
        refresh();
      } else if (/amount_too_low/i.test(msg)) toast.error('Payment amount was too low');
      else if (/sender_mismatch/i.test(msg)) toast.error('Payment must come from your connected wallet');
      else toast.error(msg);
    } finally {
      setIsOpenAllProcessing(false);
    }
  }

  async function handlePurchaseMultiplier() {
    if (!HAS_BACKEND) {
      toast.error('Backend not configured');
      return;
    }
    if (!isConnected) {
      toast.error('Connect your Base wallet first');
      return;
    }
    if (!canUpgradeMultiplier) {
      toast.error(currentMultiplier >= MAX_CARD_MULTIPLIER ? 'Maximum multiplier active' : 'Choose a higher multiplier');
      return;
    }

    setIsMultiplierProcessing(true);
    try {
      const { intent } = await paymentsApi.createIntent(
        'multiplier',
        selectedMultiplier,
        chainId,
        authChainType === "solana" ? "solana" : "evm",
      );
      let hash: string;
      if (intent.chainType === "solana") {
        if (intent.asset.type !== "spl" || !intent.asset.address) throw new Error("Solana USDC quote unavailable.");
        const { wallet, account } = await connectSolanaWallet();
        if (account.address !== solanaAddress || account.address !== baseUser?.wallet) {
          throw new Error("Reconnect the same Phantom Solana wallet you used to sign in.");
        }
        hash = await sendSolanaUsdc(
          wallet,
          account,
          intent.recipient,
          intent.asset.address,
          intent.amountAtomic,
        );
      } else {
        const to = intent.recipient as `0x${string}`;
        const usdcContract = intent.asset.address as `0x${string}` | undefined;
        if (!to || !/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('Payment recipient unavailable');
        if (!usdcContract || !/^0x[0-9a-fA-F]{40}$/.test(usdcContract)) throw new Error('USDC contract unavailable');
        if (!isConnected) throw new Error("Connect your signed-in EVM wallet first.");
        const paymentChainId = Number(intent.chainId);
        const evmHash = await sendUsdcOnEvm(to, Number(intent.amount), usdcContract, paymentChainId);
        hash = evmHash;
        await waitForUsdcTx(evmHash, paymentChainId);
      }
      toast.message(`${selectedMultiplier}x multiplier payment submitted`, { description: `${hash.slice(0, 10)}...` });

      let verified = false;
      let lastErr: ApiError | null = null;
      for (let attempt = 1; attempt <= REVEAL_MAX_ATTEMPTS; attempt += 1) {
        try {
          await paymentsApi.verifyIntent(intent.id, hash);
          verified = true;
          break;
        } catch (e) {
          const err = e as ApiError;
          lastErr = err;
          const code = String(err.message || '');
          const retryable =
            code === 'confirmations_pending' ||
            code === 'verification_in_progress' ||
            code === 'tx_not_found_yet';
          if (!retryable || attempt === REVEAL_MAX_ATTEMPTS) break;
          toast.message(`Confirming multiplier payment on-chain (${attempt}/${REVEAL_MAX_ATTEMPTS})...`);
          await new Promise((resolve) => setTimeout(resolve, REVEAL_RETRY_MS));
        }
      }
      if (!verified) throw lastErr || new Error('Multiplier payment verification failed');

      await refreshUser();
      const { session: latestSession } = await gameApi.state();
      setSession(latestSession);
      setCards(buildCards(latestSession));
      toast.success(`${selectedMultiplier}x multiplier activated permanently`);
    } catch (e) {
      const msg = asFriendlyError((e as Error).message || 'Multiplier purchase failed');
      if (/user rejected|denied|user_denied/i.test(msg)) toast.error('Payment cancelled');
      else if (/multiplier_not_upgrade/i.test(msg)) toast.error('Choose a higher multiplier');
      else if (/amount_too_low/i.test(msg)) toast.error('Payment amount was too low');
      else if (/sender_mismatch/i.test(msg)) toast.error('Payment must come from your connected wallet');
      else toast.error(msg);
    } finally {
      setIsMultiplierProcessing(false);
    }
  }

  async function handleReset() {
    try {
      const { session: s } = await gameApi.reset();
      setSession(s);
      setCards(buildCards(s));
      setLastReveal(null);
      toast.success('New card set loaded');
    } catch (e) {
      toast.error(asFriendlyError((e as Error).message || "Reset failed"));
    }
  }

  return (
    <div className="user-experience min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <header className="text-center mb-5">
        <p className="lime-kicker mb-1">Open, collect, progress</p>
        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
          Base Drop
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Open cards, find treasures, earn BD Points</p>
      </header>

      <section className={`rounded-2xl p-3 mb-4 ${DARK_GAME_CARD_CLASS}`}>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
          <span>Stage {session?.seasonStage || 1}</span>
          <span>{seasonTreasures.length}/{requiredTreasures}</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full gradient-primary transition-all" style={{ width: `${completionPct}%` }} />
        </div>
      </section>

      <section className={`rounded-2xl p-3 mb-5 ${DARK_GAME_CARD_CLASS}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold">Season Treasure Bank</p>
          <p className="text-[11px] text-muted-foreground">{seasonTreasures.length} / {requiredTreasures}</p>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {treasureSlots.map((treasure, i) => (
            <div
              key={i}
              className={`aspect-square rounded-xl border overflow-hidden flex items-center justify-center ${treasure ? 'border-primary/60 neon-glow' : 'border-border bg-secondary/40'}`}
              title={treasure?.name || 'Locked'}
            >
              {treasure ? (
                <img src={treasure.image} alt={treasure.name} className="w-full h-full object-cover" />
              ) : (
                <Gem className="w-5 h-5 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
        {session?.seasonEligible ? (
          <div className="mt-3 text-xs text-green-400 flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            Eligible for season rewards (6/6 treasures)
          </div>
        ) : null}
      </section>

      {!loading && session && (
        <section className={`rounded-2xl p-4 mb-5 ${DARK_GAME_CARD_CLASS}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <BadgePercent className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Card Multiplier</p>
                <p className={`text-xs ${hasMultiplier ? 'text-green-400' : 'text-muted-foreground'}`}>
                  {hasMultiplier ? `${currentMultiplier}x active permanently` : 'No multiplier active'}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase text-white/55">Selected</p>
              <p className="text-lg font-black text-white">{selectedMultiplier}x</p>
            </div>
          </div>

          {currentMultiplier < MAX_CARD_MULTIPLIER ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <select
                value={selectedMultiplier}
                onChange={(e) => setSelectedMultiplier(Number(e.target.value))}
                disabled={isMultiplierProcessing}
                className="h-11 rounded-xl border border-white/10 bg-background px-3 text-sm font-bold text-white outline-none focus:border-primary disabled:opacity-60"
              >
                {MULTIPLIER_OPTIONS.map((multiplier) => (
                  <option
                    key={multiplier}
                    value={multiplier}
                    disabled={multiplier <= currentMultiplier}
                  >
                    {multiplier}x - ${getCardMultiplierPrice(multiplier)} USDC
                  </option>
                ))}
              </select>
              <button
                onClick={handlePurchaseMultiplier}
                disabled={!canUpgradeMultiplier || isMultiplierProcessing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl gradient-primary px-4 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:whitespace-nowrap"
              >
                {isMultiplierProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isMultiplierProcessing ? 'Buying...' : `Buy ${selectedMultiplier}x Multiplier`}
              </button>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-center text-xs font-bold text-green-400">
              Maximum 100x multiplier active
            </p>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            One-time upgrade. Applies automatically to BD Point cards only.
          </p>
        </section>
      )}

      {loading && (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      )}
      {error && !loading && (
        <div className={`rounded-2xl p-4 mb-4 flex items-start gap-3 ${DARK_GAME_CARD_CLASS}`}>
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-destructive">Couldn't load game</p>
            <p className="text-[11px] text-muted-foreground break-words">{error}</p>
          </div>
        </div>
      )}

      {!loading && (
        <section className="grid grid-cols-4 gap-2 mb-5">
          {cards.map((card) => (
            <CardTile
              key={card.index}
              card={card}
              onCardClick={handleCardClick}
              disabled={processingIndex !== null || isOpenAllProcessing || showingOpenAllResults}
              cardPriceUsdc={cardPriceUsdc}
              cardMultiplier={currentMultiplier}
            />
          ))}
        </section>
      )}

      {!loading && session && (
        <section className={`rounded-2xl p-3 mb-4 ${DARK_GAME_CARD_CLASS}`}>
          <button
            onClick={handleOpenAllCards}
            disabled={
              processingIndex !== null ||
              isOpenAllProcessing ||
              showingOpenAllResults ||
              session.revealedCards.length > 0
            }
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isOpenAllProcessing
              ? 'Processing Open All...'
              : `Open All Cards - ${openAllPriceUsdc} USDC`}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            Opens all {cardsPerRound} cards instantly for {openAllPriceUsdc} USDC. Single-card opening still available.
          </p>
        </section>
      )}

      {lastReveal && (
        <div className={`rounded-2xl p-3 mb-4 text-center ${DARK_GAME_CARD_CLASS} ${lastReveal.result === 'treasure' ? 'border-accent/50 neon-glow' : ''}`}>
          <p className="text-sm font-bold">{lastReveal.completedSeason ? '6/6 Treasures Completed' : lastReveal.result === 'treasure' ? 'Treasure Found' : 'Empty Card'}</p>
          {lastReveal.completedSeason ? (
            <p className="text-xs text-muted-foreground">All season treasure images are unlocked in your Treasure Bank</p>
          ) : lastReveal.result === 'treasure' && lastReveal.treasure ? (
            <div className="mt-2 flex flex-col items-center gap-1">
              <img src={lastReveal.treasure.image} alt={lastReveal.treasure.name} className="w-20 h-14 object-cover rounded-lg border border-primary/50" />
              <p className="text-xs font-semibold">{lastReveal.treasure.name}</p>
              <p className="text-[11px] text-muted-foreground">Saved permanently in your Treasure Bank</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">+{lastReveal.bd} BD Points earned</p>
          )}
        </div>
      )}

      {!loading && session && (
        <div className="flex items-center justify-between text-center text-[11px] text-muted-foreground mb-5">
          <p>{cardsPerRound - session.revealedCards.length} cards remaining in this set</p>
          <button onClick={handleReset} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-secondary/40">
            <RefreshCw className="w-3 h-3" /> New set
          </button>
        </div>
      )}

      {treasureBank.length > 0 ? (
        <section className={`rounded-2xl p-3 mb-5 ${DARK_GAME_CARD_CLASS}`}>
          <p className="text-xs font-semibold mb-2">Permanent Treasure Bank</p>
          <div className="grid grid-cols-3 gap-2">
            {treasureBank.map((item) => (
              <div key={item.id} className="rounded-xl border border-primary/40 overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-16 object-cover" />
                <p className="text-[10px] font-semibold px-2 py-1 truncate">{item.name}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const CardTile = memo(function CardTile({
  card,
  onCardClick,
  disabled,
  cardPriceUsdc,
  cardMultiplier,
}: {
  card: UICard;
  onCardClick: (index: number) => void;
  disabled: boolean;
  cardPriceUsdc: number;
  cardMultiplier: number;
}) {
  const isProcessing = card.state === 'processing';
  const isRevealed = card.state === 'revealed';
  const isTreasure = card.result === 'treasure';

  return (
    <button
      onClick={() => onCardClick(card.index)}
      disabled={disabled || isRevealed || isProcessing}
      aria-label={isRevealed ? `Card ${card.index + 1} revealed: ${card.result}` : `Reveal card ${card.index + 1} for ${cardPriceUsdc} USDC`}
      className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 active:scale-95 disabled:cursor-not-allowed ${
        isRevealed
          ? isTreasure
            ? 'bg-card/95 border-2 border-accent neon-glow'
            : 'bg-card/95 border border-border opacity-70'
          : 'bg-card/95 border border-primary/40 hover:scale-[1.03]'
      }`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {isProcessing ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary-foreground" />
        ) : isRevealed ? (
          <>
            {isTreasure ? <Gem className="w-7 h-7 text-accent" /> : <span className="text-2xl opacity-60">X</span>}
            <span className="text-[10px] font-bold text-foreground">
              {isTreasure ? 'Treasure' : `+${card.bdPointsEarned} BD`}
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl font-black text-primary-foreground/90">?</span>
            <span className="text-[9px] font-semibold text-primary-foreground/80">{cardPriceUsdc} USDC</span>
            {cardMultiplier >= MIN_CARD_MULTIPLIER ? (
              <span className="text-[9px] font-bold text-accent">{cardMultiplier}x</span>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
});
