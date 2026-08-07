import { describe, expect, it } from "vitest";
import { mailgunProvider } from "../providers/mailgun";
import { nodemailerProvider } from "../providers/nodemailer";
import { postmarkProvider } from "../providers/postmark";
import { testEmailProviderContract } from "./provider-contract.test";

testEmailProviderContract("mailgun", () => mailgunProvider, {
	sendBehavior: "throws",
	throwsContains: "skeleton",
});

testEmailProviderContract("nodemailer", () => nodemailerProvider, {
	sendBehavior: "throws",
	throwsContains: "skeleton",
});

testEmailProviderContract("postmark", () => postmarkProvider, {
	sendBehavior: "throws",
	throwsContains: "skeleton",
});

describe("mail skeletons — error messages", () => {
	it("mailgun names the provider in the error", async () => {
		await expect(
			mailgunProvider.send({
				from: "a",
				to: "b",
				subject: "x",
				html: "",
				text: "",
			}),
		).rejects.toThrow("[mail:mailgun]");
	});

	it("nodemailer names the provider in the error", async () => {
		await expect(
			nodemailerProvider.send({
				from: "a",
				to: "b",
				subject: "x",
				html: "",
				text: "",
			}),
		).rejects.toThrow("[mail:nodemailer]");
	});

	it("postmark names the provider in the error", async () => {
		await expect(
			postmarkProvider.send({
				from: "a",
				to: "b",
				subject: "x",
				html: "",
				text: "",
			}),
		).rejects.toThrow("[mail:postmark]");
	});
});
