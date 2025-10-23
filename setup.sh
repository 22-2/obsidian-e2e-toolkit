# e2e-setup.sh
# This script prepares the Obsidian E2E testing environment by unpacking
# asar files included in the repository.

set -e

# =============================================================================
# Color Constants
# =============================================================================
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[0;33m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_RED='\033[0;31m'
readonly COLOR_NC='\033[0m'

# =============================================================================
# Utility Functions
# =============================================================================

# Print colored log messages
log_info() {
    echo -e "${COLOR_CYAN}$1${COLOR_NC}"
}

log_success() {
    echo -e "${COLOR_GREEN}$1${COLOR_NC}"
}

log_warning() {
    echo -e "${COLOR_YELLOW}$1${COLOR_NC}"
}

log_error() {
    echo -e "${COLOR_RED}$1${COLOR_NC}" >&2
    exit 1
}

# =============================================================================
# Validation Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v jq &> /dev/null; then
        log_error "Error: 'jq' is not installed. Please install it to proceed."
    fi

    if ! command -v pnpm &> /dev/null; then
        log_error "Error: 'pnpm' is not installed. Please make sure it is available in the environment."
    fi

    log_success "Prerequisites check passed."
}

validate_plugin_manifest() {
    local manifest_path="$1"

    log_info "Reading plugin info from ${manifest_path}..."

    if [[ ! -f "$manifest_path" ]]; then
        log_error "Error: Plugin manifest not found at '${manifest_path}'."
    fi

    local plugin_id
    plugin_id=$(jq -r '.id' "$manifest_path")

    if [[ -z "$plugin_id" || "$plugin_id" == "null" ]]; then
        log_error "Error: Could not read 'id' from '${manifest_path}'."
    fi

    echo "  - Plugin ID: ${plugin_id}"
    echo "$plugin_id"
}

# =============================================================================
# Core Functions
# =============================================================================

setup_paths() {
    # SCRIPT_DIR: Location of this setup.sh script (e.g., node_modules/obsidian-e2e-toolkit/)
    readonly SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
    
    # PROJECT_ROOT: Current working directory (where npm script is executed from)
    # This should be the plugin project root containing manifest.json
    readonly PROJECT_ROOT=$(pwd)
    
    # Plugin-related paths (in project root)
    readonly PLUGIN_SOURCE_FULL_PATH="${PROJECT_ROOT}"
    readonly PLUGIN_MANIFEST_PATH="${PLUGIN_SOURCE_FULL_PATH}/manifest.json"
    
    # Toolkit-related paths (in node_modules/obsidian-e2e-toolkit/ or local directory)
    readonly OBSIDIAN_UNPACKED_PATH="${SCRIPT_DIR}/.obsidian-unpacked"
    readonly E2E_ASSETS_DIR="${SCRIPT_DIR}/assets"
    readonly APP_ASAR_PATH="${E2E_ASSETS_DIR}/app.asar"
    readonly OBSIDIAN_ASAR_PATH="${E2E_ASSETS_DIR}/obsidian.asar"
    readonly APP_ASAR_UNPACKED_ZIP_PATH="${E2E_ASSETS_DIR}/app.asar.unpacked.zip"
    readonly APP_ASAR_UNPACKED_DIR_PATH="${E2E_ASSETS_DIR}/app.asar.unpacked"
    readonly APP_MAIN_FILE="main.cjs"
}

unpack_obsidian_assets() {
    log_success "\nUnpacking Obsidian ASAR archives..."

    # Validate required files
    if [[ ! -f "$APP_ASAR_PATH" ]]; then
        log_error "Error: app.asar not found at '${APP_ASAR_PATH}'. Make sure the file is present in the assets directory."
    fi

    # Clean up and create directory
    log_info "Cleaning up previous unpack directory..."
    rm -rf "$OBSIDIAN_UNPACKED_PATH"
    mkdir -p "$OBSIDIAN_UNPACKED_PATH"

    # Unzip app.asar.unpacked.zip if it exists
    if [[ -f "$APP_ASAR_UNPACKED_ZIP_PATH" ]]; then
        log_info "Unzipping app.asar.unpacked.zip..."
        rm -rf "$APP_ASAR_UNPACKED_DIR_PATH"
        unzip -q "$APP_ASAR_UNPACKED_ZIP_PATH" -d "$(dirname "$APP_ASAR_UNPACKED_ZIP_PATH")"
        log_success "Unzip completed."
    else
        log_warning "Warning: app.asar.unpacked.zip not found. Skipping unzip."
    fi

    # Extract app.asar
    log_info "Extracting ${APP_ASAR_PATH} to ${OBSIDIAN_UNPACKED_PATH}"
    pnpm exec asar extract "${APP_ASAR_PATH}" "${OBSIDIAN_UNPACKED_PATH}"

    # Rename main.js to main.cjs to treat it as a CommonJS module
    local main_js_path="${OBSIDIAN_UNPACKED_PATH}/main.js"
    local main_cjs_path="${OBSIDIAN_UNPACKED_PATH}/${APP_MAIN_FILE}"
    if [[ -f "$main_js_path" ]]; then
        log_info "Renaming main.js to ${APP_MAIN_FILE}..."
        mv "$main_js_path" "$main_cjs_path"
        log_success "Renaming completed."
    else
        log_warning "Warning: main.js not found after extraction. Skipping rename."
    fi

    # Copy obsidian.asar if it exists
    if [[ -f "$OBSIDIAN_ASAR_PATH" ]]; then
        log_info "Copying ${OBSIDIAN_ASAR_PATH} to ${OBSIDIAN_UNPACKED_PATH}/"
        cp "$OBSIDIAN_ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH/"
    else
        log_warning "Warning: obsidian.asar not found at '${OBSIDIAN_ASAR_PATH}'. Skipping."
    fi

    log_success "Asset unpacking completed."
}

build_plugin() {
    log_success "\nBuilding plugin for E2E tests..."

    if ! (cd "$PLUGIN_SOURCE_FULL_PATH" && pnpm build); then
        log_error "Failed to build plugin."
    fi

    log_success "Plugin build completed."
}

# =============================================================================
# Main Function
# =============================================================================

main() {
    log_success "Starting E2E setup process..."

    # Initialize paths
    setup_paths

    # Check prerequisites
    check_prerequisites

    # Read and validate plugin manifest
    local plugin_id
    plugin_id=$(validate_plugin_manifest "$PLUGIN_MANIFEST_PATH")

    # Execute setup steps
    unpack_obsidian_assets
    build_plugin

    log_success "\nE2E setup process finished successfully."
}

# =============================================================================
# Script Execution
# =============================================================================

main "$@"
