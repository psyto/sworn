//! Sworn answering code (spec 002 §1, spec 001 R3.3 / R3.7 "live hardfork drift").
//!
//! The fork-schedule rule: the guest resolves the hardfork from Moderato's genesis config compiled
//! into `core` (`moderato_fork_time`). The server reads the LIVE schedule from the node's
//! `tempo_forkSchedule` RPC (tempo/crates/node/src/rpc/fork_schedule.rs) and refuses to answer if
//!   (a) any fork's activation time differs, or a fork is present on one side only, or
//!   (b) any activation lies within MAX_AGE blocks of N's timestamp, either side.
//! MAX_AGE is 32 blocks (Sworn.sol); converted to time at a conservative 2 s/block (Moderato
//! produces ~0.6 s blocks), i.e. ±64 s.
use spike_core::moderato_fork_time;
pub use tempo_chainspec::TempoHardfork;

pub const MAX_AGE_BLOCKS: u64 = 32;
pub const MAX_BLOCK_SECS: u64 = 2;
pub const ACTIVATION_GUARD_SECS: u64 = MAX_AGE_BLOCKS * MAX_BLOCK_SECS;

/// The guest's schedule: (fork name as `tempo_forkSchedule` reports it, activation time), excluding
/// Genesis (the RPC excludes it too).
pub fn guest_schedule() -> Vec<(String, u64)> {
    TempoHardfork::VARIANTS
        .iter()
        .filter(|f| **f != TempoHardfork::Genesis)
        .filter_map(|f| moderato_fork_time(*f).map(|t| (f.to_string(), t)))
        .collect()
}

/// `Err(reason)` = refuse.
pub fn check_fork_schedule(live: &[(String, u64)], n_timestamp: u64) -> Result<(), String> {
    let guest = guest_schedule();
    let mut problems = vec![];
    for (name, t) in live {
        match guest.iter().find(|(g, _)| g == name) {
            None => problems.push(format!("live fork {name}@{t} unknown to the guest")),
            Some((_, gt)) if gt != t => problems.push(format!("{name}: live activation {t} != guest {gt}")),
            _ => {}
        }
    }
    for (name, t) in &guest {
        if !live.iter().any(|(l, _)| l == name) {
            problems.push(format!("guest fork {name}@{t} absent from the live schedule"));
        }
    }
    if !problems.is_empty() {
        return Err(format!("fork schedule mismatch: {}", problems.join("; ")));
    }
    for (name, t) in &guest {
        if t.abs_diff(n_timestamp) <= ACTIVATION_GUARD_SECS {
            return Err(format!(
                "activation of {name} at {t} is within MAX_AGE ({MAX_AGE_BLOCKS} blocks ≈ {ACTIVATION_GUARD_SECS} s) of N's timestamp {n_timestamp}"
            ));
        }
    }
    Ok(())
}

/// Parse a `tempo_forkSchedule` result into (name, activationTime).
pub fn parse_live_schedule(v: &serde_json::Value) -> Result<Vec<(String, u64)>, String> {
    v["schedule"]
        .as_array()
        .ok_or_else(|| format!("tempo_forkSchedule: no schedule in {v}"))?
        .iter()
        .map(|f| {
            Ok((
                f["name"].as_str().ok_or("fork name")?.to_string(),
                f["activationTime"].as_u64().ok_or("activationTime")?,
            ))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn live() -> Vec<(String, u64)> {
        guest_schedule()
    }
    // A time far from every activation: T11 + 1 day (T12 is weeks later on Moderato).
    fn quiet() -> u64 {
        moderato_fork_time(TempoHardfork::T11).unwrap() + 86_400
    }

    #[test]
    fn s4_accepts_identical_schedule() {
        assert_eq!(check_fork_schedule(&live(), quiet()), Ok(()));
    }
    #[test]
    fn s4_refuses_changed_activation() {
        let mut l = live();
        l.last_mut().unwrap().1 += 1;
        let e = check_fork_schedule(&l, quiet()).unwrap_err();
        assert!(e.contains("mismatch"), "{e}");
    }
    #[test]
    fn s4_refuses_extra_live_fork() {
        let mut l = live();
        l.push(("T99".into(), 1));
        assert!(check_fork_schedule(&l, quiet()).unwrap_err().contains("unknown to the guest"));
    }
    #[test]
    fn s4_refuses_missing_live_fork() {
        let mut l = live();
        l.pop();
        assert!(check_fork_schedule(&l, quiet()).unwrap_err().contains("absent from the live"));
    }
    #[test]
    fn s4_refuses_activation_within_max_age() {
        let t11 = moderato_fork_time(TempoHardfork::T11).unwrap();
        for n_ts in [t11 - ACTIVATION_GUARD_SECS, t11 - 1, t11, t11 + 1, t11 + ACTIVATION_GUARD_SECS] {
            assert!(check_fork_schedule(&live(), n_ts).unwrap_err().contains("within MAX_AGE"), "{n_ts}");
        }
        assert_eq!(check_fork_schedule(&live(), t11 + ACTIVATION_GUARD_SECS + 1), Ok(()));
        assert_eq!(check_fork_schedule(&live(), t11 - ACTIVATION_GUARD_SECS - 1), Ok(()));
    }
}
