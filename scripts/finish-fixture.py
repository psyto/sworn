#!/usr/bin/env python3
"""Adds the decoded Question/Answer and a WRONG claimed Answer (receiverAfter = receiverBefore +
transfer amount — what a dishonest server says for a receive-policy-blocked transfer) to the Groth16
fixture, and writes out/fixtures/guest.json (GUEST_VERSION, vkey). The proof is always of the TRUE
answer; the contract test pairs it with the wrong claimed Answer."""
import json, sys, subprocess
fx = sys.argv[1]
f = json.load(open(fx))
vec = json.load(open("out/fixtures/vectors.json"))
v = next(x for x in vec["vectors"] if x["publicValues"].lower() == f["publicValues"].lower())
amount = int(v["q"]["data"][2 + 8 + 64: 2 + 8 + 128], 16)
wrong = dict(v["a"]); wrong["receiverAfter"] = str(int(v["a"]["receiverBefore"]) + amount)
assert wrong != v["a"]
enc = subprocess.check_output(["cast", "abi-encode", "f((bool,bytes32,uint64,uint256,address,uint256,uint256))",
    "(%s,%s,%s,%s,%s,%s,%s)" % (str(wrong["success"]).lower(), wrong["returnDataHash"], wrong["gasUsed"], wrong["feeCharged"],
    wrong["receiver"], wrong["receiverBefore"], wrong["receiverAfter"])]).decode().strip()
f.update({"case": v["case"], "GUEST_VERSION": vec["GUEST_VERSION"], "question": v["q"], "trueAnswer": v["a"],
          "q_abi": v["q_abi"], "trueAnswer_abi": v["a_abi"], "wrongClaimedAnswer": wrong, "wrongClaimedAnswer_abi": enc})
json.dump(f, open(fx, "w"), indent=1)
json.dump({"GUEST_VERSION": vec["GUEST_VERSION"], "GUEST_VERSION_LABEL": vec["GUEST_VERSION_LABEL"],
           "GUEST_VKEY": f["vkey"], "sp1_sdk": "6.3.1", "verifier": "SP1VerifierGroth16 v6.1.0"},
          open("out/fixtures/guest.json", "w"), indent=1)
print("ok", v["case"], "wrong receiverAfter", wrong["receiverAfter"])
