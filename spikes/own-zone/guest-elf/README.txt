The exact SP1 guest ELF whose vkey is pinned by the own-zone SwornZoneVerifier:
  sha256 6f6fb01e42cd46a2753b12637242fc4b4b4023f1cce3f24ef1e770b5f636d6e4
  vkey   0x00ab5a9e697e8e1f81e1db06c7e41afd5dd046438f50b972a48c417d724a5c7b
Built from spikes/zone-spf/guest + patches/attest-own-zone.patch, zones ac49071f + patches/zones-own-zone.patch,
SP1 6.3.1. The ELF embeds absolute source paths (panic locations), so a rebuild in another directory gives a
DIFFERENT ELF and vkey. Use this file; build.sh verifies its sha256 and vkey and does not rebuild the guest.
