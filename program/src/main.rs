//! Sworn SP1 guest (spec 001 §R3.1/R3.7/R3.8): verify header + witness, execute the R3.2
//! transaction with fees ON, commit EXACTLY
//! `publicValues = abi.encode(bytes32 GUEST_VERSION, bytes32 blockHash, Question q, Answer a)`.
//! Any R3.3 abort panics, so no proof exists.
#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    let input: spike_core::Input = sp1_zkvm::io::read();
    let (public_values, _, _) = spike_core::run(&input).unwrap_or_else(|a| panic!("sworn abort: {a}"));
    sp1_zkvm::io::commit_slice(&public_values);
}
