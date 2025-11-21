"use client";

import { useEffect, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEEncryptedDrop } from "~~/hooks/useFHEEncryptedDrop";

export const FHEEncryptedDrop = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const survey = useFHEEncryptedDrop({ instance: fhevmInstance, mockChains: initialMockChains });

  // Form states
  const [email, setEmail] = useState("");
  const [discord, setDiscord] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [github, setGithub] = useState("");

  const wallet = survey.accounts?.[0] ?? "";

  // Validation
  const validate = () => {
    const rules = [
      wallet && wallet.startsWith("0x") && wallet.length === 42,
      email.includes("@") && email.includes("."),
      discord.includes("#") && discord.split("#")[1]?.length >= 3,
      xHandle.startsWith("@") && xHandle.length >= 4,
      github.length >= 2 && !github.includes(" "),
    ];
    return rules.every(Boolean);
  };

  const validationPassed = validate();

  // Random flag
  const computeFlag = () => {
    if (!validationPassed) return 0;
    return Math.random() > 0.5 ? 1 : 0;
  };

  // Fireworks state
  const [firework, setFirework] = useState(false);

  const eligibilityDisplay = () => {
    if (survey.decodedFlag === 1) return "Eligible 🎉";
    if (survey.decodedFlag === 0) return "Not eligible 😢";
    return null;
  };

  useEffect(() => {
    if (survey.decodedFlag === 1) {
      setFirework(true);
      const t = setTimeout(() => setFirework(false), 2000);
      return () => clearTimeout(t);
    }
  }, [survey.decodedFlag]);

  if (!isConnected) {
    return (
      <div className="w-full flex flex-col items-center justify-center h-[calc(100vh-60px)] text-center">
        <h2 className="text-3xl font-extrabold mb-4 text-gradient bg-gradient-to-r from-yellow-400 via-orange-300 to-yellow-500 bg-clip-text text-transparent">
          Connect your wallet
        </h2>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-60px)] flex items-center justify-center bg-[#0b0b1a] p-6 sm:p-10 relative overflow-hidden">
      <motion.div
        className="max-w-xl w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="w-full text-4xl font-bold mb-6 text-center text-gradient bg-gradient-to-r from-yellow-400 via-orange-300 to-yellow-500 bg-clip-text text-transparent">
          Encrypted Airdrop Eligibility Check
        </h1>

        {survey.alreadyRegistered ? (
          <motion.div className="mt-10 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={survey.decrypt}
              disabled={!survey.canDecrypt || survey.isDecrypting}
              className="w-[539px] bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-3 px-6 rounded-xl shadow-lg transition"
            >
              {survey.isDecrypting ? "Checking..." : "Decrypt Eligibility"}
            </button>

            {survey.decodedFlag !== null && (
              <motion.p
                className="text-yellow-400 text-3xl mt-4 font-extrabold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {eligibilityDisplay()}
              </motion.p>
            )}

            {firework && <Fireworks trigger={firework} />}
          </motion.div>
        ) : (
          <motion.div
            className="bg-[#1c1c2f] border border-[#333355] rounded-2xl p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <FormInput label="Wallet Address" value={wallet} disabled />
            <FormInput label="Email" value={email} placeholder="your@email..." onChange={setEmail} />
            <FormInput label="Discord Username" value={discord} placeholder="example#1234" onChange={setDiscord} />
            <FormInput label="X (Twitter) Handle" value={xHandle} placeholder="@yourname" onChange={setXHandle} />
            <FormInput label="Github Username" value={github} placeholder="username" onChange={setGithub} />

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const flag = computeFlag();
                survey.registerFlag(flag);
              }}
              disabled={survey.isPending}
              className={`w-full mt-4 py-3 px-6 rounded-xl font-semibold text-white shadow-lg transition bg-yellow-500 hover:bg-yellow-400`}
            >
              {survey.isPending ? "Checking..." : "Check Eligibility"}
            </motion.button>

            {survey.statusMsg && <p className="text-gray-300 text-sm mt-4">{survey.statusMsg}</p>}
          </motion.div>
        )}
      </motion.div>

      {/* Fireworks component */}
      <Fireworks trigger={firework} />
    </div>
  );
};

// --------------------
// Form Input Component
// --------------------
const FormInput = ({ label, value, onChange, placeholder, disabled = false }) => (
  <div className="mb-4">
    <span className="text-white">{label}</span>
    <input
      disabled={disabled}
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full mt-1 bg-[#2a2a44] text-white p-3 rounded-lg border border-[#444466] focus:ring-2 focus:ring-yellow-400 outline-none ${
        disabled ? "opacity-60" : ""
      }`}
    />
  </div>
);

// --------------------
// Fireworks Component
// --------------------
const Fireworks = ({ trigger }: { trigger: boolean }) => {
  const [particles, setParticles] = useState<{ x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    if (trigger) {
      const newParticles = Array.from({ length: 25 }, () => ({
        x: Math.random() * 200 - 100,
        y: Math.random() * -200,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);
    }
  }, [trigger]);

  return (
    <AnimatePresence>
      {trigger &&
        particles.map((p, idx) => (
          <motion.div
            key={idx}
            className="absolute w-2 h-2 rounded-full bg-yellow-400"
            style={{ left: "50%", bottom: "20%" }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
            transition={{ delay: p.delay, duration: 1 }}
          />
        ))}
    </AnimatePresence>
  );
};
