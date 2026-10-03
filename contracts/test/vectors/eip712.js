// Independent EIP-712 reference for Sworn's reservation digest, using ethers' TypedDataEncoder
// (not Solidity). Run: NODE_PATH=~/node_modules node test/vectors/eip712.js > test/vectors/eip712.json
const { ethers } = require("ethers");
const enc = ethers.TypedDataEncoder || ethers.utils._TypedDataEncoder;
const domain = { name: "Sworn", version: "1", chainId: 42431,
  verifyingContract: "0x5300000000000000000000000000000000000001" };
const types = {
  SwornAnswer: [{ name: "question", type: "Question" }, { name: "answer", type: "Answer" }],
  Question: [
    { name: "chainId", type: "uint64" }, { name: "blockNumber", type: "uint64" },
    { name: "blockHash", type: "bytes32" }, { name: "from", type: "address" },
    { name: "token", type: "address" }, { name: "data", type: "bytes" },
    { name: "feeToken", type: "address" }, { name: "gasLimit", type: "uint64" }],
  Answer: [
    { name: "success", type: "bool" }, { name: "returnDataHash", type: "bytes32" },
    { name: "gasUsed", type: "uint64" }, { name: "feeCharged", type: "uint256" },
    { name: "receiver", type: "address" }, { name: "receiverBefore", type: "uint256" },
    { name: "receiverAfter", type: "uint256" }],
};
const q = { chainId: 42431, blockNumber: 1234567, blockHash: "0x" + "ab".repeat(32),
  from: "0x1111111111111111111111111111111111111111",
  token: "0x20C0000000000000000000000000000000000001",
  // transfer(0x2222…2222, 500_000_000)
  data: "0xa9059cbb" + "2222222222222222222222222222222222222222".padStart(64, "0") + (500000000).toString(16).padStart(64, "0"),
  feeToken: "0x20C0000000000000000000000000000000000000", gasLimit: 300000 };
const a = { success: true, returnDataHash: ethers.keccak256 ? ethers.keccak256("0x" + "00".repeat(31) + "01") : ethers.utils.keccak256("0x" + "00".repeat(31) + "01"),
  gasUsed: 51234, feeCharged: 25617, receiver: "0x2222222222222222222222222222222222222222",
  receiverBefore: 1000000, receiverAfter: 501000000 };
const value = { question: q, answer: a };
console.log(JSON.stringify({
  ethersVersion: ethers.version,
  domainSeparator: enc.hashDomain(domain),
  questionHash: enc.hashStruct("Question", types, q),
  answerHash: enc.hashStruct("Answer", types, a),
  encodeType: enc.from(types).encodeType("SwornAnswer"),
  digest: enc.hash(domain, types, value),
  q, a }, null, 1));
