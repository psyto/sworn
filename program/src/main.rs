//! SP1 guest: header binding + MPT verification + tempo-revm execution of one call.
#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    let input: spike_core::Input = sp1_zkvm::io::read();
    let out = spike_core::run(&input);
    sp1_zkvm::io::commit(&out);
}
