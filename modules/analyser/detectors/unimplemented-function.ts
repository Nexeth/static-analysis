import { ContractDefinition, FunctionDefinition } from "@solidity-parser/parser/dist/src/ast-types";

import { AbstractDetector } from "./abstract-detector";

import { SolidityParser } from "@/modules";
import { DetectorViolation, ParsedContracts, Severity } from "@/types";

export const UNIMPLEMENTED_FUNCTION_DETECTOR = "unimplemented-function";

export class UnimplementedFunctionDetector implements AbstractDetector {
  public id = UNIMPLEMENTED_FUNCTION_DETECTOR;
  public title = "Unimplemented Function";
  public description = "Detects unimplemented functions on derived contracts";
  public severity = Severity.Informational;

  detect(
    code: ParsedContracts
    // config: AnalyserConfig = {}
  ): Promise<DetectorViolation[]> {
    const violations: DetectorViolation[] = [];

    const addViolation = (target: string, name: string, violation: string) => {
      violations.push({ target, name, violation });
    };

    const contracts = SolidityParser.getContracts(code);

    contracts.forEach((contract) => {
      const functions = this.detectUnimplementedFunction(contract, contracts);
      functions.forEach((func) => {
        addViolation("function", func.name ?? "unknown", "unimplemented");
      });
    });

    return Promise.resolve(violations);
  }

  private detectUnimplementedFunction(
    contract: ContractDefinition,
    contracts: ContractDefinition[]
  ): FunctionDefinition[] {
    const unimplemented: FunctionDefinition[] = [];

    const implementedFunctions = SolidityParser.getFunctions([contract]);
    const inheritedContracts = SolidityParser.getInheritedContracts(contract, contracts);

    inheritedContracts.forEach((inheritedContract) => {
      const inheritedFunctions = SolidityParser.getFunctions([inheritedContract]);
      inheritedFunctions.forEach((inheritedFunction) => {
        if (inheritedFunction.isConstructor) return;
        if (inheritedFunction.isFallback) return;

        let isImplemented = implementedFunctions.some(
          (func) => func.name === inheritedFunction.name
        );

        if (!isImplemented && this.matchStateVariable(contract, inheritedFunction)) {
          isImplemented = true;
        }

        if (!isImplemented) {
          unimplemented.push(inheritedFunction);
        }
      });
    });

    return unimplemented;
  }

  /**
   * Since Solidity v0.5.1, a state variable can be used to return the value for a function.
   */
  private matchStateVariable(contract: ContractDefinition, func: FunctionDefinition): boolean {
    // TODO only run if Solidity version > 0.5.1
    const stateVariables = SolidityParser.getStateVariables([contract]);

    return stateVariables.some((stateVariable) =>
      stateVariable.variables.some((variable) => variable.name === func.name)
    );
  }
}
