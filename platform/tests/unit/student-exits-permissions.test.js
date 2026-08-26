'use strict';
const access=require('../../modules/student_exits/access');
function ctx(overrides){const rows=Object.entries(Object.assign({},access.DEFAULTS,overrides||{})).map(([action,roles])=>({action,roles_json:JSON.stringify(roles)}));return{db:{query:()=>({rows})}}}
function req(role,permissions){return{user:{role,id:role,permissions:permissions||[]}}}
describe('student exits permission boundary',()=>{
 test('campus sanction defaults to reception, secretaries and administrators',()=>{const c=ctx();for(const role of ['reception','secretary','admin','principal'])expect(access.can(req(role),c,'principal-ed','campus_authorise')).toBe(true);expect(access.can(req('teacher'),c,'principal-ed','campus_authorise')).toBe(false)});
 test('restricted reasons remain unavailable to ordinary staff',()=>{const c=ctx();expect(access.can(req('teacher'),c,'principal-ed','restricted_view')).toBe(false);expect(access.can(req('medical'),c,'principal-ed','restricted_view')).toBe(true)});
 test('school policy can change role assignments without granting global privilege',()=>{const c=ctx({release:['teacher','learning_support']});expect(access.can(req('learning_support'),c,'principal-ed','release')).toBe(true);expect(access.can(req('learning_support'),c,'principal-ed','configure')).toBe(false)});
 test('platform superusers retain governed emergency access',()=>{expect(access.can(req('staff',['admin:*']),ctx(),'principal-ed','configure')).toBe(true)});
});
