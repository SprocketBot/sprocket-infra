import * as pulumi from "@pulumi/pulumi";
export * from "./WithOverrides";

declare global {
  const __brand: unique symbol;
}

export type Outputable<T> = T | pulumi.Output<T>;

/**
 * Tests if two types are equal
 */
export type Equals<T, S> = [T] extends [S]
  ? [S] extends [T]
    ? true
    : false
  : false;

type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;

export type StandardEnum<T> = {
  [id: string]: T | string;
  [nu: number]: string;
};

export type StringEnum<T extends string = string> = { [key in T]: string };
