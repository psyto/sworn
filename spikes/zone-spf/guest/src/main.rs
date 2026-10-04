//! SP1 guest (spec 003 §4): run Tempo Zones' own stateless proof function (zone-spf
//! `prove_zone_batch`) and commit `abi.encode(ZONE_GUEST_VERSION, digest)`, where `digest` is the
//! EIP-712 hashStruct of `SwornZoneBatchAttestation` (spec §3). All of it lives in
//! `sworn-zone-attest`, which the native host also calls; this file only does I/O.
#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    let input = sp1_zkvm::io::read_vec();
    let input = sworn_zone_attest::decode_input(&input).unwrap_or_else(|e| panic!("{e}"));
    // Aborts if verifier_config != "sworn-sp1-groth16-v1", if the genesis does not parse, or if prove_zone_batch rejects.
    let outcome = sworn_zone_attest::execute(input).unwrap_or_else(|e| panic!("{e}"));
    sp1_zkvm::io::commit_slice(&outcome.public_values);
}

// SPIKE-ZKVM-8: c-kzg's C code (KZG point-evaluation precompile, linked via revm-precompile) needs
// libc's malloc/calloc/free, which the zkVM target does not provide. Back them with Rust's global
// allocator, storing the layout size in a 16-byte header. (Not exercised by the batches here.)
mod c_alloc {
    use std::alloc::{Layout, alloc, alloc_zeroed, dealloc};
    const HDR: usize = 16;
    unsafe fn raw(size: usize, zeroed: bool) -> *mut u8 {
        let Some(total) = size.checked_add(HDR) else { return core::ptr::null_mut() };
        let layout = Layout::from_size_align(total, HDR).unwrap();
        let p = if zeroed { unsafe { alloc_zeroed(layout) } } else { unsafe { alloc(layout) } };
        if p.is_null() {
            return p;
        }
        unsafe { (p as *mut usize).write(total) };
        unsafe { p.add(HDR) }
    }
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn malloc(size: usize) -> *mut u8 {
        unsafe { raw(size, false) }
    }
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn calloc(n: usize, size: usize) -> *mut u8 {
        match n.checked_mul(size) {
            Some(s) => unsafe { raw(s, true) },
            None => core::ptr::null_mut(),
        }
    }
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn free(p: *mut u8) {
        if p.is_null() {
            return;
        }
        let base = unsafe { p.sub(HDR) };
        let total = unsafe { (base as *const usize).read() };
        unsafe { dealloc(base, Layout::from_size_align(total, HDR).unwrap()) };
    }
}
