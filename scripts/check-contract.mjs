import fs from 'node:fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import YAML from 'yaml';
const spec=YAML.parse(fs.readFileSync('contracts/openapi.yaml','utf8'));
await SwaggerParser.validate(structuredClone(spec));
const defs=JSON.parse(JSON.stringify(spec.components.schemas).replaceAll('#/components/schemas/','#/$defs/'));
const ajv=new Ajv({strict:false,allErrors:true});formats(ajv);
const base={$id:'piora', $schema:'https://json-schema.org/draft/2020-12/schema',$defs:defs};ajv.addSchema(base);
let n=0;
for(const ex of JSON.parse(fs.readFileSync('contracts/examples.json','utf8'))){
 const validate=ajv.compile({$ref:'piora#/$defs/'+ex.schema});
 if(!validate(ex.value))throw new Error(ex.name+': '+JSON.stringify(validate.errors));n++;
}
console.log('Validated OpenAPI and '+n+' schema examples.');
