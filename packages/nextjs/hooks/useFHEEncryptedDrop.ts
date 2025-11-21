"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import {
  FhevmInstance,
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEEncryptedDrop = ({
  instance,
  mockChains,
}: {
  instance?: FhevmInstance;
  mockChains?: Readonly<Record<number, string>>;
}) => {
  const { storage: signatureStore } = useInMemoryStorage();
  const { chainId, accounts, ethersSigner, ethersReadonlyProvider, isConnected } = useWagmiEthers(mockChains);

  const activeChain = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;

  const { data: dropContract } = useDeployedContractInfo({
    contractName: "FHEEncryptedDrop",
    chainId: activeChain,
  });

  type DropInfo = Contract<"FHEEncryptedDrop"> & { chainId?: number };

  const [statusMsg, setStatusMsg] = useState("");
  const [isPending, setIsPending] = useState(false);

  const contractAvailable = Boolean(dropContract?.address && dropContract?.abi);
  const signerAvailable = Boolean(ethersSigner);
  const providerAvailable = Boolean(ethersReadonlyProvider);

  const getDropInstance = (mode: "read" | "write") => {
    if (!contractAvailable) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(dropContract!.address, (dropContract as DropInfo).abi, providerOrSigner);
  };

  // -----------------------------
  // READ encrypted data
  // -----------------------------
  const { data: encryptedData, refetch: refreshEncrypted } = useReadContract({
    address: contractAvailable ? (dropContract!.address as `0x${string}`) : undefined,
    abi: contractAvailable ? ((dropContract as DropInfo).abi as any) : undefined,
    functionName: "readEncrypted",
    args: [accounts?.[0] ?? ""],
    query: { enabled: !!(contractAvailable && providerAvailable), refetchOnWindowFocus: false },
  });

  const encryptedValue = useMemo(() => encryptedData as string | undefined, [encryptedData]);

  const alreadyRegistered = useMemo(() => {
    return (
      Boolean(encryptedValue) &&
      encryptedValue !== ethers.ZeroHash &&
      encryptedValue !== "0x0" &&
      encryptedValue !== "0x"
    );
  }, [encryptedValue]);

  // -----------------------------
  // DECRYPTION SETUP
  // -----------------------------
  const decryptRequest = useMemo(() => {
    if (!contractAvailable || !encryptedValue) return undefined;
    return [{ handle: encryptedValue, contractAddress: dropContract!.address }] as const;
  }, [contractAvailable, encryptedValue, dropContract?.address]);

  const {
    decrypt,
    results,
    message: decryptMsg,
    canDecrypt,
    isDecrypting,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    chainId,
    requests: decryptRequest,
    fhevmDecryptionSignatureStorage: signatureStore,
  });

  const [decodedFlag, setDecodedFlag] = useState<number | null>(null);

  useEffect(() => {
    if (!results || Object.keys(results).length === 0) return;
    const key = Object.keys(results)[0];
    const decrypted = results[key];
    if (typeof decrypted === "bigint") setDecodedFlag(Number(decrypted));
  }, [results]);

  useEffect(() => {
    if (decryptMsg) setStatusMsg(decryptMsg);
  }, [decryptMsg]);

  // -----------------------------
  // ENCRYPTION SETUP
  // -----------------------------
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: dropContract?.address,
  });

  const getEncryptFn = (fnName: "registerFlag") => {
    const fnEntry = dropContract?.abi.find(i => i.type === "function" && i.name === fnName);
    if (!fnEntry) return { method: undefined, err: `Missing ABI for function: ${fnName}` };
    return { method: getEncryptionMethod(fnEntry.inputs?.[0]?.internalType), err: undefined };
  };

  // -----------------------------
  // WRITE → registerFlag()
  // -----------------------------
  const registerFlag = useCallback(
    async (flag: number) => {
      if (flag == null || isPending) return;
      setIsPending(true);

      try {
        setStatusMsg("Checking your eligibility…");

        const { method, err } = getEncryptFn("registerFlag");
        if (!method) return setStatusMsg(err ?? "Cannot detect encryption method");

        const encryptedPayload = await encryptWith(ctx => (ctx as any)[method](flag));
        if (!encryptedPayload) return setStatusMsg("Encryption failed");

        const dropWrite = getDropInstance("write");
        if (!dropWrite) return setStatusMsg("Contract instance unavailable");

        const params = buildParamsFromAbi(encryptedPayload, [...dropContract!.abi] as any[], "registerFlag");

        const tx = await dropWrite.registerFlag(...params, { gasLimit: 400_000 });
        await tx.wait();

        await refreshEncrypted();
        setStatusMsg("Your eligibility has been recorded!"); 
      } catch (e) {
        setStatusMsg('❌ Error occurred')
      } finally {
        setIsPending(false);
      }
    },
    [encryptWith, getDropInstance, dropContract?.abi, isPending, refreshEncrypted],
  );

  return {
    registerFlag,
    decrypt,
    canDecrypt,
    isDecrypting,
    decodedFlag,
    encryptedValue,
    alreadyRegistered,
    statusMsg,
    isPending,
    hasContract: contractAvailable,
    hasSigner: signerAvailable,
    accounts,
    chainId,
    isConnected,
  };
};
