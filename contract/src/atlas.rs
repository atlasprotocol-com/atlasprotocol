// src/atlas.rs
use near_sdk::{env, near_bindgen};

pub use crate::modules::admin::*;
pub use crate::modules::deposits::*;
pub use crate::modules::signer::*;
pub use crate::modules::structs::*;
pub use crate::modules::utils::*;
pub use crate::modules::validation::*;

#[near_bindgen]
impl Atlas {

}
