import React, { useState, useMemo, useEffect } from "react";
import { Keypair, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { InfinitySpin } from "react-loader-spinner";
import IPFSDownload from "./IpfsDownload";
import { addOrder, fetchItem, hasPurchased } from "../lib/api";
import { findReference, FindReferenceError } from "@solana/pay";

const STATUS = {
    Initial: "Initial",
    Submitted: "Submitted",
    Paid: "Paid",
};

export default function Buy({ itemID, coin }) {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const orderID = useMemo(() => Keypair.generate().publicKey, []); // Public key used to identify the order

    const [paid, setPaid] = useState(null);
    const [loading, setLoading] = useState(false); // Loading state of all above
    const [status, setStatus] = useState(STATUS.Initial);
    const [item, setItem] = useState(null); // IPFS hash & filename of the purchased item

    // useMemo is a React hook that only computes the value if the dependencies change
    const order = useMemo(
        () => ({
            buyer: publicKey.toString(),
            orderID: orderID.toString(),
            itemID: itemID,
            coin: coin
        }),
        [publicKey, orderID, itemID, coin]
    );

    // Fetch the transaction object from the server
    const processTransaction = async () => {
        setLoading(true);
        const txResponse = await fetch("../api/createTransaction", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(order),
        });
        const txData = await txResponse.json();

        // We create a transaction object
        const tx = Transaction.from(Buffer.from(txData.transaction, "base64"));
        console.log("Tx data is", tx);

        // Attempt to send the transaction to the network
        try {
            // Send the transaction to the network
            const txHash = await sendTransaction(tx, connection);
            console.log(`Transaction sent: https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
            setStatus(STATUS.Submitted);

            // Check if transaction was confirmed
            const confirmation = await connection.confirmTransaction(txHash, 'finalized');
            if (confirmation.value.err) {
                throw new Error('Transaction failed');
            }

            console.log('Transaction confirmed:', confirmation);
            setStatus(STATUS.Paid);
            addOrder(order);
            alert("Thank you for your purchase!");

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Check if this address already has already purchased this item
        // If so, fetch the item and set paid to true
        // Async function to avoid blocking the UI
        async function checkPurchased() {
            const purchased = await hasPurchased(publicKey, itemID);
            if (purchased) {
                setStatus(STATUS.Paid);
                const item = await fetchItem(itemID);
                setItem(item);
                console.log("Address has already purchased this item!");
            }
        }
        checkPurchased();
    }, [publicKey, itemID, coin]);

    useEffect(() => {
        async function getItem(itemID) {
            const item = await fetchItem(itemID);
            setItem(item);
            console.log('Item set :' + item)
        }

        if (status === STATUS.Paid) {
            getItem(itemID);
        }
    }, [status]);

    if (!publicKey) {
        return (
            <div>
                <p>You need to connect your wallet to make transactions</p>
            </div>
        );
    }

    if (loading) {
        return <InfinitySpin color="gray" />;
    }

    return (
        <div>
            { status === STATUS.Paid  && item ? (
              <>
                  <IPFSDownload filename={item?.filename} hash={item?.hash}/>
                  <button disabled={loading} className="buy-button mt-4" onClick={processTransaction} >
                      Mua lại
                  </button>
              </>
            ) : (
                <button disabled={loading} className="buy-button" onClick={processTransaction}>
                    Mua ngay
                </button>
            )}
        </div>
    );
}
