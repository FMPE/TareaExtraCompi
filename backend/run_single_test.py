#!/usr/bin/env python3
"""
Ejecuta un solo test del parser LR(1) o todos los tests.
Uso: 
    python run_single_test.py <test_name>
    python run_single_test.py --all
"""

import sys
import os
from run_all_tests import run_test, EXPECTED_RESULTS, main

def run_single_test(test_name):
    """Run a single specified test."""
    if test_name not in EXPECTED_RESULTS:
        print(f"Error: Test '{test_name}' no encontrado.")
        print(f"Tests disponibles: {list(EXPECTED_RESULTS.keys())}")
        return False
    
    print(f"EJECUTANDO TEST INDIVIDUAL: {test_name}\n")
    result = run_test(test_name)
    
    if result:
        print(f"\n✅ Test {test_name} PASÓ")
    else:
        print(f"\n❌ Test {test_name} FALLÓ")
    
    return result

def show_help():
    """Show usage information."""
    print("Uso:")
    print("  python run_single_test.py <test_name>    - Ejecutar un test específico")
    print("  python run_single_test.py --all          - Ejecutar todos los tests")
    print("  python run_single_test.py --list         - Listar tests disponibles")
    print("  python run_single_test.py --help         - Mostrar esta ayuda")
    print()
    print("Tests disponibles:")
    for test_name, expected in EXPECTED_RESULTS.items():
        status = "VALID" if expected else "INVALID"
        print(f"  - {test_name:<25} (esperado: {status})")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        show_help()
        sys.exit(1)
    
    arg = sys.argv[1]
    
    if arg in ["--help", "-h"]:
        show_help()
    elif arg in ["--all", "-a"]:
        main()
    elif arg in ["--list", "-l"]:
        print("Tests disponibles:")
        for test_name, expected in EXPECTED_RESULTS.items():
            status = "VALID" if expected else "INVALID"
            print(f"  - {test_name:<25} (esperado: {status})")
    else:
        run_single_test(arg)
